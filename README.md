# Cashu Address

A proposal for Cashu Mints as better Lightning-Address custodians.

## Abstract

Cashu Mints can offer a better and more sovereign custodial Lightning experience.
However because eCash tokens are stored by the users themselves,
offline receiving can be challenging.
This proposal introduces a LNURL service that generates tokens on received payments
and holds on to them for a user, until they come back online.

## How to use this repo

This readme outlines the general concept, its implementation details.
The src directory includes a naive POC written in Typescript.

## Basic flow

Definitions

- `user`: Payee, entity behind a Lightning address
- `payer`: Entity requesting a payment request through a users lightning address.
- `server`: LNURL server providing the Lightning address service.

1. `user` registers for the service.
   _Note: this proposal does not cover Authorization,
   however the included POC utilities NIP-98_
2. `server` maps the user account internally
   and creates a corresponding LUD-16 endpoint.
3. When `server` receives a pay-request it requests a corresponding invoice
   from the Cashu Mint. It then creates an invoice of its own, maps it to the mint-invoice
   and returns it to the `payer` (this makes sure `payer` can not
   race `server` to redeem the payment at the mint).
4. Once the server-invoice has been paid by `payer`,
   the `server` pays the mint-invoice, redeems it for tokens
   and adds them to the `user`'s claimable-proofs list in its database.
5. Once `user` goes online, they send an authorized request
   to the `server`’s /claim endpoint and receive back all tokens
   that were collected by `server` for them.
