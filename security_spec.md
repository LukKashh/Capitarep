# Security Specification & Invariants

## Data Invariants

1. A player state record can only be created and updated by the authenticated user whose `uid` equals the document `{userId}`.
2. The `userId` field within the player state document cannot be altered after creation (immutability).
3. A corporation can only be created by an authenticated user who is set as the `founderId`.
4. Ledger entries are append-only. Once created, ledger entries cannot be updated or deleted.
5. Username index mappings cannot be hijacked; only the user matching `userId` can register or update the mapping.

## The Dirty Dozen Attack Payloads & Test Scenarios

1. **Unauthenticated Read of Player State**: Unauthenticated user tries to read `/player_states/victim123` -> PERMISSION_DENIED.
2. **Identity Spoofing on Player Create**: User `attacker456` attempts to create `/player_states/victim123` with `userId: "victim123"` -> PERMISSION_DENIED.
3. **Ghost Field Injection**: User sends extra arbitrary undeclared payload fields -> Validation rejected.
4. **Id Poisoning**: Attacker injects a 2KB string as `userId` -> `isValidId` fails -> PERMISSION_DENIED.
5. **Overwriting Ledger Record**: Attacker attempts `update` on `/ledger/tx789` -> PERMISSION_DENIED.
6. **Deleting Corporation**: Non-founder / attacker attempts to delete `/corporations/corp1` -> PERMISSION_DENIED.
7. **Username Squatting / Hijack**: Attacker tries to overwrite `/usernames/elon` where `existing().userId != attacker.uid` -> PERMISSION_DENIED.
8. **Malicious Negative Value**: Attacker writes negative `version` or invalid types -> Schema check fails -> PERMISSION_DENIED.
9. **Blanket Write to Root Catchall**: Attacker attempts to write to an unmapped path `/_system/config` -> Caught by default-deny catchall -> PERMISSION_DENIED.
10. **Tampering with Stock Sold Counter**: Attacker attempts to decrement or write non-numeric stock values -> Validation fails -> PERMISSION_DENIED.
11. **Impersonating Corporation Founder**: Non-member updates corporation settings claiming to be founder -> Validation rejects unauthorized caller -> PERMISSION_DENIED.
12. **Unauthenticated Stock Read**: Unauthenticated user attempts to scrape collectible stocks -> PERMISSION_DENIED.
