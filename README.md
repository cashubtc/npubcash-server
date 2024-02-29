<br />
<div align="center">
  <a href="https://github.com/github_username/repo_name">
    <img src="https://image.nostr.build/c6720e6ad2ac5726792254a0097e2cc3b75c18036f88de914a5a2684a7d6c170.jpg" alt="Logo" width="80" height="80">
  </a>

<h3 align="center">npub.cash server</h3>

  <p align="center">
    The webserver powering npub.cash
    <br />
    <a href="https://docs.cashu-address.com"><strong>Explore the docs »</strong></a>
    <br />
    <br />
    <a href="https://npub.cash">View Demo</a>
  </p>
</div>

## About The Project

Cashu Mints can offer a better and more sovereign custodial Lightning experience. However because eCash tokens are stored by the users themselves, offline receiving can be challenging. npub.cash introduces a LNURL service that generates tokens on received payments and holds on to them for a user, until they come back online. This is a reference implemenation of the npub.cash service written in Typescript.

## Getting Started

npubcash-server is a NodeJs application written in TypeScript. Below is a step-by-step on how to get it started.

### Prerequisites

- Node and npm. Install NodeJs and it's package manager npm.

### Installation

1. Clone the repo

```sh
git clone https://github.com/github_username/repo_name.git
```

2. Install NPM packages

```sh
npm install
```

3. Setup your environment varaibles according to `example.env`. Variables from `.env` will be automatically read by the development server, but not the production build.

4. Start the development server

```sh
npm run dev
```

## Usage

By default the dev server will include the projects landing page on the root domain.
For more details check out the [documentation](https://docs.cashu-address.com)

## Roadmap

- [x] Implement basic API
- [x] Implement NIP-05 endpoint for all users
- [x] Add notifications
- [ ] Improved error handling and logging
- [ ] Remove Blink API (depends on cashu webhooks)
- [ ] Implement NUT-10 (depends on ecosystem)

## Contributing

Contributions are what make the open source community such an amazing place to learn, inspire, and create. Any contributions you make are **greatly appreciated**.

If you have a suggestion that would make this better, please fork the repo and create a pull request. You can also simply open an issue with the tag "enhancement".

## License

Distributed under the MIT License. See `LICENSE.txt` for more information.

## Contact

Lead Maintainer: Egge - [@egge21m on Twitter](https://twitter.com/egge21m) - [or on nostr](nostr:npub1mhcr4j594hsrnen594d7700n2t03n8gdx83zhxzculk6sh9nhwlq7uc226)
