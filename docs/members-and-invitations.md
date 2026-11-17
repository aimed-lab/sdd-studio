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

You can invite people to your own role or a lower one. Nobody can be invited as Owner.

## Joining
1. Open the invitation link, or go to [studio.smartdrugdiscovery.org/login](https://studio.smartdrugdiscovery.org/login).
2. Choose **Sign in with your SDD account** and sign in at auth.smartdrugdiscovery.org with the email address the invitation was sent to.
3. The first time, enter your invitation code. After that, sign in with your SDD account alone.

A code is refused if your SDD account's email address is not the one the invitation was sent to.

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

## Single sign-on
Studio signs people in through the lab's single sign-on at auth.smartdrugdiscovery.org, the same SDD account used by the other lab apps.
- Studio checks the signed-in account on its server for every members-only request, and keeps each person's role in its own database.
- A session lasts 8 hours. **Sign out** also ends the SDD sign-in.
- Campaign data still needs that campaign's project key.

The shared code `SPARC2026` was retired on 2026-11-15. Ask the platform owner for a personal invitation instead.
