# Cashu Address
A proposal for Cashu Mints as better Lightning-Address custodians. 

## Abstract
Cashu Mints can offer a better and more sovereign custodial Lightning experience. However because eCash tokens are stored by the users themselves, offline receiving can be challenging.
This proposal introduces a LNURL service that generates tokens on received payments and holds on to them for a user, until they come back online.

## How to use this repo

This readme outlines the general concept, its implementation details. The src directory includes a naive POC written in Typescript.

## Basic flow

1. A user registers for the service. Note: this proposal does not cover Authorization, however the included POC utilities NIP-98
2. The server maps the user account internally and creates a corresponding LUD-16 endpoint.
3. When the server receives a pay-request it requests a corresponding invoice from the Cashu Mint. It then creates an invoice of its own, maps it to the mint-invoice and returns it to the payer (this makes sure payers can not race the server to redeem the payment at the mint).
4. Once the invoice has been paid by the payer, the server pays the mint-invoice, redeems it for tokens and adds them to the users claimable-proofs list
5. Once a user goes online, they send an authorized request to the server’s /claim endpoint and receive back all tokens that were collected by the server for this particular user.
