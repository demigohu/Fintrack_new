#!/bin/bash

# Download ckETH

DIR=target/ic

mkdir -p "$DIR"

IC_COMMIT="bb6e758c739768ef6713f9f3be2df47884544900"

scripts/download-immutable.sh "https://download.dfinity.systems/ic/$IC_COMMIT/canisters/ic-cketh-minter.wasm.gz" "$DIR"/cketh_minter.wasm.gz
gunzip --keep --force "$DIR"/cketh_minter.wasm.gz

# ckETH requires special ledger and index to handle 18 decimals, therefore the special wasm
scripts/download-immutable.sh "https://download.dfinity.systems/ic/$IC_COMMIT/canisters/ic-icrc1-ledger-u256.wasm.gz" "$DIR"/cketh_ledger.wasm.gz
gunzip --keep --force "$DIR"/cketh_ledger.wasm.gz

scripts/download-immutable.sh "https://download.dfinity.systems/ic/$IC_COMMIT/canisters/ic-icrc1-index-ng-u256.wasm.gz" "$DIR"/cketh_index.wasm.gz
gunzip --keep --force "$DIR"/cketh_index.wasm.gz

scripts/download-immutable.sh "https://raw.githubusercontent.com/dfinity/ic/$IC_COMMIT/rs/ethereum/cketh/minter/cketh_minter.did" "$DIR"/cketh_minter.did

scripts/download-immutable.sh "https://raw.githubusercontent.com/dfinity/ic/$IC_COMMIT/rs/ledger_suite/icrc1/ledger/ledger.did" "$DIR"/cketh_ledger.did

scripts/download-immutable.sh "https://raw.githubusercontent.com/dfinity/ic/$IC_COMMIT/rs/ledger_suite/icrc1/index-ng/index-ng.did" "$DIR"/cketh_index.did