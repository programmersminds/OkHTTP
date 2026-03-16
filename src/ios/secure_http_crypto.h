#ifndef secure_http_crypto_h
#define secure_http_crypto_h

#include <stdbool.h>
#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

bool        crypto_init(void);
char*       crypto_encrypt(const char* plaintext, const char* key);
char*       crypto_decrypt(const char* ciphertext, const char* key);
char*       crypto_sign(const char* data, int64_t timestamp, const char* key);
bool        crypto_store_key(const char* key, const char* value);
char*       crypto_get_key(const char* key);
bool        crypto_remove_key(const char* key);
bool        crypto_clear_storage(void);
char*       crypto_generate_key(void);
bool        crypto_verify_integrity(void);
void        crypto_free_string(char* s);

#ifdef __cplusplus
}
#endif

#endif /* secure_http_crypto_h */
