
# Guesty OAuth + API Workflow

## Authentication Flow

```text
Login
  -> sessionToken
Generate PKCE
  -> codeVerifier + codeChallenge
OAuth Authorize
  -> authCode
Exchange Token
  -> accessToken + idToken
Authenticated APIs
```

## Environment Variables

| Variable | Purpose |
|---|---|
| username | Guesty username |
| password | Guesty password |
| issuer | OAuth issuer |
| clientId | OAuth client ID |
| redirectUri | OAuth callback |
| sessionToken | Created after login |
| codeVerifier | PKCE verifier |
| codeChallenge | PKCE SHA256 challenge |
| authCode | OAuth authorization code |
| accessToken | Main API bearer token |
| idToken | Identity token |

## API Data Models

### Listing
```ts
type Listing = {
  _id: string;
  title: string;
  nickname: string;
  address: {
    full: string;
  };
  picture?: {
    thumbnail?: string;
  };
};
```

### Reservation
```ts
type Reservation = {
  _id: string;
  listingId: string;
  confirmationCode: string;
  status: string;
  guest: {
    name: string;
    email?: string;
  };
  checkIn: string;
  checkOut: string;
  guestsCount: number;
  money: {
    hostPayout: {
      value: number;
      currency: string;
    };
    totalPaid: {
      value: number;
      currency: string;
    };
  };
};
```
