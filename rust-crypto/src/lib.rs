use aes_gcm::{
    aead::{Aead, KeyInit},
    Aes256Gcm, Nonce,
};
use base64::{engine::general_purpose, Engine as _};
use hmac::{Hmac, Mac};
use ring::rand::{SecureRandom, SystemRandom};
use sha2::Sha256;
use std::collections::HashMap;
use std::ffi::{CStr, CString};
use std::os::raw::c_char;
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};

type HmacSha256 = Hmac<Sha256>;

static STORAGE: Mutex<Option<HashMap<String, String>>> = Mutex::new(None);
static REQUEST_LOG: Mutex<Option<Vec<(String, u64)>>> = Mutex::new(None);
static INTEGRITY_KEY: Mutex<Option<[u8; 32]>> = Mutex::new(None);

#[no_mangle]
pub extern "C" fn crypto_init() -> bool {
    let mut integrity = INTEGRITY_KEY.lock().unwrap();
    if integrity.is_none() {
        let rng = SystemRandom::new();
        let mut key = [0u8; 32];
        if rng.fill(&mut key).is_ok() {
            *integrity = Some(key);
            return true;
        }
    }
    false
}

#[no_mangle]
pub extern "C" fn crypto_encrypt(plaintext: *const c_char, key: *const c_char) -> *mut c_char {
    if !verify_integrity() {
        return std::ptr::null_mut();
    }

    let plaintext = unsafe { CStr::from_ptr(plaintext).to_str().unwrap() };
    let key = unsafe { CStr::from_ptr(key).to_str().unwrap() };

    if detect_tampering(plaintext) {
        return std::ptr::null_mut();
    }

    match encrypt_internal(plaintext, key) {
        Ok(result) => {
            log_request("encrypt");
            CString::new(result).unwrap().into_raw()
        }
        Err(_) => std::ptr::null_mut(),
    }
}

#[no_mangle]
pub extern "C" fn crypto_decrypt(ciphertext: *const c_char, key: *const c_char) -> *mut c_char {
    if !verify_integrity() {
        return std::ptr::null_mut();
    }

    let ciphertext = unsafe { CStr::from_ptr(ciphertext).to_str().unwrap() };
    let key = unsafe { CStr::from_ptr(key).to_str().unwrap() };

    if detect_replay_attack("decrypt") {
        return std::ptr::null_mut();
    }

    match decrypt_internal(ciphertext, key) {
        Ok(result) => {
            log_request("decrypt");
            CString::new(result).unwrap().into_raw()
        }
        Err(_) => std::ptr::null_mut(),
    }
}

#[no_mangle]
pub extern "C" fn crypto_sign(
    data: *const c_char,
    timestamp: i64,
    key: *const c_char,
) -> *mut c_char {
    if !verify_integrity() {
        return std::ptr::null_mut();
    }

    let data = unsafe { CStr::from_ptr(data).to_str().unwrap() };
    let key = unsafe { CStr::from_ptr(key).to_str().unwrap() };

    if !verify_timestamp(timestamp) {
        return std::ptr::null_mut();
    }

    let result = sign_internal(data, timestamp, key);
    log_request("sign");
    CString::new(result).unwrap().into_raw()
}

#[no_mangle]
pub extern "C" fn crypto_store_key(key: *const c_char, value: *const c_char) -> bool {
    if !verify_integrity() {
        return false;
    }

    let key = unsafe { CStr::from_ptr(key).to_str().unwrap().to_string() };
    let value = unsafe { CStr::from_ptr(value).to_str().unwrap().to_string() };

    let encrypted_value = match encrypt_internal(&value, &get_master_key()) {
        Ok(v) => v,
        Err(_) => return false,
    };

    let mut storage = STORAGE.lock().unwrap();
    if storage.is_none() {
        *storage = Some(HashMap::new());
    }
    storage.as_mut().unwrap().insert(key, encrypted_value);
    log_request("store");
    true
}

#[no_mangle]
pub extern "C" fn crypto_get_key(key: *const c_char) -> *mut c_char {
    if !verify_integrity() {
        return std::ptr::null_mut();
    }

    let key = unsafe { CStr::from_ptr(key).to_str().unwrap() };

    let storage = STORAGE.lock().unwrap();
    if let Some(map) = storage.as_ref() {
        if let Some(encrypted_value) = map.get(key) {
            if let Ok(value) = decrypt_internal(encrypted_value, &get_master_key()) {
                log_request("get");
                return CString::new(value).unwrap().into_raw();
            }
        }
    }
    std::ptr::null_mut()
}

#[no_mangle]
pub extern "C" fn crypto_remove_key(key: *const c_char) -> bool {
    if !verify_integrity() {
        return false;
    }

    let key = unsafe { CStr::from_ptr(key).to_str().unwrap() };

    let mut storage = STORAGE.lock().unwrap();
    if let Some(map) = storage.as_mut() {
        map.remove(key);
        log_request("remove");
        return true;
    }
    false
}

#[no_mangle]
pub extern "C" fn crypto_generate_key() -> *mut c_char {
    if !verify_integrity() {
        return std::ptr::null_mut();
    }

    let rng = SystemRandom::new();
    let mut key_bytes = [0u8; 32];
    if rng.fill(&mut key_bytes).is_err() {
        return std::ptr::null_mut();
    }
    let key = general_purpose::STANDARD.encode(&key_bytes);
    log_request("generate");
    CString::new(key).unwrap().into_raw()
}

#[no_mangle]
pub extern "C" fn crypto_verify_integrity() -> bool {
    verify_integrity()
}

#[no_mangle]
pub extern "C" fn crypto_free_string(s: *mut c_char) {
    if !s.is_null() {
        unsafe { CString::from_raw(s) };
    }
}

fn verify_integrity() -> bool {
    let integrity = INTEGRITY_KEY.lock().unwrap();
    integrity.is_some()
}

fn verify_timestamp(timestamp: i64) -> bool {
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_secs() as i64;
    let diff = (now - timestamp).abs();
    diff <= 300
}

fn detect_tampering(data: &str) -> bool {
    data.contains("<script>")
        || data.contains("javascript:")
        || data.contains("eval(")
        || data.len() > 1_000_000
}

fn detect_replay_attack(operation: &str) -> bool {
    let mut log = REQUEST_LOG.lock().unwrap();
    if log.is_none() {
        *log = Some(Vec::new());
    }

    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_secs();
    let log_vec = log.as_mut().unwrap();

    log_vec.retain(|(_, time)| now - time < 60);

    let recent_count = log_vec
        .iter()
        .filter(|(op, time)| op == operation && now - time < 1)
        .count();

    recent_count > 10
}

fn log_request(operation: &str) {
    let mut log = REQUEST_LOG.lock().unwrap();
    if log.is_none() {
        *log = Some(Vec::new());
    }

    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_secs();
    log.as_mut().unwrap().push((operation.to_string(), now));
}

fn get_master_key() -> String {
    let integrity = INTEGRITY_KEY.lock().unwrap();
    if let Some(key) = *integrity {
        return general_purpose::STANDARD.encode(&key);
    }
    String::from("fallback-key-should-not-happen")
}

fn encrypt_internal(plaintext: &str, key_str: &str) -> Result<String, String> {
    let key = derive_key(key_str);
    let cipher = Aes256Gcm::new(&key.into());
    let rng = SystemRandom::new();

    let mut nonce_bytes = [0u8; 12];
    rng.fill(&mut nonce_bytes).map_err(|_| "RNG failure")?;

    let nonce = Nonce::from_slice(&nonce_bytes);
    let ciphertext = cipher
        .encrypt(nonce, plaintext.as_bytes())
        .map_err(|_| "Encryption failed")?;

    let mut result = nonce_bytes.to_vec();
    result.extend_from_slice(&ciphertext);
    Ok(general_purpose::STANDARD.encode(&result))
}

fn decrypt_internal(encrypted: &str, key_str: &str) -> Result<String, String> {
    let key = derive_key(key_str);
    let cipher = Aes256Gcm::new(&key.into());

    let data = general_purpose::STANDARD
        .decode(encrypted)
        .map_err(|_| "Invalid base64")?;

    if data.len() < 12 {
        return Err("Invalid data".to_string());
    }

    let (nonce_bytes, ciphertext) = data.split_at(12);
    let plaintext = cipher
        .decrypt(Nonce::from_slice(nonce_bytes), ciphertext)
        .map_err(|_| "Decryption failed")?;

    String::from_utf8(plaintext).map_err(|_| "Invalid UTF-8".to_string())
}

fn sign_internal(data: &str, timestamp: i64, key_str: &str) -> String {
    let key = derive_key(key_str);
    let mut mac = <HmacSha256 as Mac>::new_from_slice(&key).expect("HMAC init");
    mac.update(data.as_bytes());
    mac.update(&timestamp.to_le_bytes());
    general_purpose::STANDARD.encode(mac.finalize().into_bytes())
}

fn derive_key(key_str: &str) -> [u8; 32] {
    let mut key = [0u8; 32];
    let bytes = key_str.as_bytes();
    let len = bytes.len().min(32);
    key[..len].copy_from_slice(&bytes[..len]);
    key
}
