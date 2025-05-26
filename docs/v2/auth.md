## Authentication

Every npub.cash v2 endpoint, but the LNURL endpoint, is protected. A protected endpoint can be access by providing either a NIP-98 or JWT auth token in the requests `Authorization` header.

### NIP-98 HTTP Auth

Access any protected endpoint by providing a NIP-98 HTTP Auth header according to [NIP-98](https://github.com/nostr-protocol/nips/blob/master/98.md)
When creating a NIP-98 event for endpoints that supports query parameters, these need to be omitted!

```
Nostr
eyJpZCI6ImZlOTY0ZTc1ODkwMzM2MGYyOGQ4NDI0ZDA5MmRhODQ5NGVkMjA3Y2JhODIzMTEwYmUzYTU3ZGZlNGI1Nzg3MzQiLCJwdWJrZXkiOiI2M2ZlNjMxOGRjNTg1ODNjZmUxNjgxMGY4NmRkMDllMThiZmQ3NmFhYmMyNGEwMDgxY2UyODU2ZjMzMDUwNGVkIiwiY29udGVudCI6IiIsImtpbmQiOjI3MjM1LCJjcmVhdGVkX2F0IjoxNjgyMzI3ODUyLCJ0YWdzIjpbWyJ1IiwiaHR0cHM6Ly9hcGkuc25vcnQuc29jaWFsL2FwaS92MS9uNXNwL2xpc3QiXSxbIm1ldGhvZCIsIkdFVCJdXSwic2lnIjoiNWVkOWQ4ZWM5NThiYzg1NGY5OTdiZGMyNGFjMzM3ZDAwNWFmMzcyMzI0NzQ3ZWZlNGEwMGUyNGY0YzMwNDM3ZmY0ZGQ4MzA4Njg0YmVkNDY3ZDlkNmJlM2U1YTUxN2JiNDNiMTczMmNjN2QzMzk0OWEzYWFmODY3MDVjMjIxODQifQ
```

### JWT Auth

Additionally to NIP-98 auth, npub.cash v2 supports JWT auth. This is useful when clients do not have access to the users private key and would need to prompt for signatures repeatedly.
A JWT can be obtained by sending a single NIP-98 request to `/api/v2/auth/nip98`:

```json
{
  "error": false,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJwIjoiOTZhMGU4NTVhMWNlNzczYjU2YWE0MzgzYzAyNzdhOWNkYjJjNjhhNDA0OTQyNWIzZWQ4NjIyNzU1ZDdmNTA4ZiIsInUiOiJhMDRkYmZlMzIyOTZkNzA3ZDk1OTg4OGJlMzNjYzMyODc1ODU1NmNmNTg3ODBhNjU0OTk5ZWFhNDBkZGIzODcyIiwibCI6Im5pcDk4IiwidyI6dHJ1ZSwiaWF0IjoxNzQ4MjQzMjIyLCJleHAiOjE3NDgyNDUwMjJ9.uTj86U24bKKYWz0w6Z7Fvfhi273hNqQ0c0Y1adu1aFk"
  }
}
```

Access a protected endpoint by providing a JWT in the requests `Authorization` header.

```
Bearer
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJwIjoiOTZhMGU4NTVhMWNlNzczYjU2YWE0MzgzYzAyNzdhOWNkYjJjNjhhNDA0OTQyNWIzZWQ4NjIyNzU1ZDdmNTA4ZiIsInUiOiJhMDRkYmZlMzIyOTZkNzA3ZDk1OTg4OGJlMzNjYzMyODc1ODU1NmNmNTg3ODBhNjU0OTk5ZWFhNDBkZGIzODcyIiwibCI6Im5pcDk4IiwidyI6dHJ1ZSwiaWF0IjoxNzQ4MjQzMjIyLCJleHAiOjE3NDgyNDUwMjJ9.uTj86U24bKKYWz0w6Z7Fvfhi273hNqQ0c0Y1adu1aFk
```
