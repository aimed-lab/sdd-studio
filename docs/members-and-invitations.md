# Members and invitations

SDD Studio is open to anyone for its public tools (compound search, the trial landscape, target pages and the curated EGFR set). Everything else needs an account, and accounts are by invitation only.

## Inviting people (Owner and Admins)
1. Go to **Settings → Member Management → Invite people by email**.
2. Paste one or more email addresses, one per line or separated by commas.
3. Choose a role. **Developer** is the default.
4. Choose **Create invitations**.

Each person gets their own 8-character code that:
- works only with their email address;
- expires after 14 days;
- makes the account active as soon as it is used.

Studio can email each person their link. If it can't, or you prefer to send it yourself, **Copy all** gives a list of email, code and link.

Owner, Admin and TechSupport cannot be granted from Studio until single sign-on is enabled. Developer and User can.

## Joining
1. Open the invitation link, or go to [studio.smartdrugdiscovery.org/login](https://studio.smartdrugdiscovery.org/login).
2. Enter the email address the invitation was sent to, and the code.
3. From then on, sign in with that email address alone.

A code entered with a different email address is refused.

## Removing access
- **An unused invitation:** choose **Revoke** in the invitation list. The email address can no longer sign in.
- **Someone who has joined:** use **Suspend** or **Revoke access** in the member list. An admin can reactivate the account later from the same list.
- **Push tokens:** each member revokes their own tokens under **Projects → Developer sandbox → Push tokens**.

## Roles
| Role | Summary |
|---|---|
| Owner | Everything, including member management and ownership transfer |
| Admin | Member management and settings |
| TechSupport | Support tools |
| Developer | Workspace and developer pages |
| User | Workspace |

Any active member can create push tokens for the developer sandbox.

## Before single sign-on
Until the lab's single sign-on is connected (issue #32), sign-in checks only the email address after the first sign-in:
- **The code** controls who can create an account.
- **It does not control** who uses the account afterwards: anyone who knows a member's email address can sign in as them.

This is why real project data stays out of Studio, and only the developer sandbox (test data) accepts pushes, until single sign-on is on.

The shared code `SPARC2026` was retired on 2026-11-15. Ask the platform owner for a personal invitation instead.
