# Changelog

## [5.5.7](https://github.com/hexrift/zentla/compare/v5.5.6...v5.5.7) (2026-01-04)


### Bug Fixes

* analytics limit, add currency/country settings, workspace webhook secret ([#49](https://github.com/hexrift/zentla/issues/49)) ([a2d748a](https://github.com/hexrift/zentla/commit/a2d748a3e91db4ae4e4935dea51f20c725e3faeb))

## [5.5.6](https://github.com/hexrift/zentla/compare/v5.5.5...v5.5.6) (2026-01-04)


### Bug Fixes

* return 'url' instead of 'sessionUrl' in checkout session response ([#47](https://github.com/hexrift/zentla/issues/47)) ([a027d1c](https://github.com/hexrift/zentla/commit/a027d1cb84b1f91b9beaee66ce5076387faabb1d))

## [5.5.5](https://github.com/hexrift/zentla/compare/v5.5.4...v5.5.5) (2026-01-04)


### Bug Fixes

* use workspace-level billing check in promotions and stripe-sync ([#45](https://github.com/hexrift/zentla/issues/45)) ([cc59e19](https://github.com/hexrift/zentla/commit/cc59e19b86ba32fa33d0bbec06bd79b1459b6645))

## [5.5.4](https://github.com/hexrift/zentla/compare/v5.5.3...v5.5.4) (2026-01-04)


### Bug Fixes

* use workspace-level billing provider across all services ([#43](https://github.com/hexrift/zentla/issues/43)) ([e07b1cc](https://github.com/hexrift/zentla/commit/e07b1cccd54d7f1b325dc2ddbdcdc50708514318))

## [5.5.3](https://github.com/hexrift/zentla/compare/v5.5.2...v5.5.3) (2026-01-04)


### Bug Fixes

* use getProviderForWorkspace in syncToProvider ([#41](https://github.com/hexrift/zentla/issues/41)) ([1377f2e](https://github.com/hexrift/zentla/commit/1377f2efa98166599f4ff9b70896e30e9f46a552))

## [5.5.2](https://github.com/hexrift/zentla/compare/v5.5.1...v5.5.2) (2026-01-04)


### Bug Fixes

* check workspace billing config in syncToProvider ([#39](https://github.com/hexrift/zentla/issues/39)) ([f442137](https://github.com/hexrift/zentla/commit/f442137842d87144b0fa721294b8bc63c6fa3127))

## [5.5.1](https://github.com/hexrift/zentla/compare/v5.5.0...v5.5.1) (2026-01-04)


### Bug Fixes

* billing config check and settings UX improvements ([#37](https://github.com/hexrift/zentla/issues/37)) ([e86e268](https://github.com/hexrift/zentla/commit/e86e2689abe8daff67c40b9ffd5a98d5f2f13e60))

## [5.5.0](https://github.com/hexrift/zentla/compare/v5.4.0...v5.5.0) (2026-01-04)


### Features

* branding positioning update ([#35](https://github.com/hexrift/zentla/issues/35)) ([485d644](https://github.com/hexrift/zentla/commit/485d644c774a171cef06170bb8b857a04eb4286e))

## [5.4.0](https://github.com/hexrift/zentla/compare/v5.3.0...v5.4.0) (2026-01-04)


### Features

* **api:** add Phase 4 revenue analytics dashboard ([#32](https://github.com/hexrift/zentla/issues/32)) ([d35ad7f](https://github.com/hexrift/zentla/commit/d35ad7f1bf32abc9b8b9ef5fa42dd7e42b4261c7))

## [5.3.0](https://github.com/hexrift/zentla/compare/v5.2.0...v5.3.0) (2026-01-04)


### Features

* **api:** add Phase 3 A/B experiment infrastructure ([#30](https://github.com/hexrift/zentla/issues/30)) ([9fe4402](https://github.com/hexrift/zentla/commit/9fe440248151863f0eb7b2022b8b100ab7314900))

## [5.2.0](https://github.com/hexrift/zentla/compare/v5.1.0...v5.2.0) (2026-01-04)


### Features

* monetization infrastructure phases 1 & 2 ([#28](https://github.com/hexrift/zentla/issues/28)) ([b9bc675](https://github.com/hexrift/zentla/commit/b9bc67586a6e741840aab6416123b3baddc0caae))

## [5.1.0](https://github.com/hexrift/zentla/compare/v5.0.1...v5.1.0) (2026-01-04)


### Features

* **web:** add changelog page to docs ([#25](https://github.com/hexrift/zentla/issues/25)) ([4a15b79](https://github.com/hexrift/zentla/commit/4a15b795f2016b02fac2b12563d2119ee35a739e))

## [5.0.1](https://github.com/hexrift/zentla/compare/v5.0.0...v5.0.1) (2026-01-04)


### Bug Fixes

* **ci:** use squash merge for release PRs ([#21](https://github.com/hexrift/zentla/issues/21)) ([efc2dba](https://github.com/hexrift/zentla/commit/efc2dbaf5ec99c38dc0add9c218e2bba7469e9b8))

## [5.0.0](https://github.com/hexrift/zentla/compare/v4.0.0...v5.0.0) (2026-01-04)


### ⚠ BREAKING CHANGES

* API responses now use new status values. Existing subscriptions will be migrated via database migration.

### Features

* add checkout page to admin ui ([7a3c92b](https://github.com/hexrift/zentla/commit/7a3c92b73baec56913be88fe9189b7dcadae138b))
* Add customer portal endpoint ([48c29a6](https://github.com/hexrift/zentla/commit/48c29a64026eff433310595f2ab17a09cce9b1e6))
* add favicon and apple-touch-icon ([ee5add7](https://github.com/hexrift/zentla/commit/ee5add7a15e2a8493e45b43f509fcba90b754e2b))
* add favicon and apple-touch-icon ([9f79b24](https://github.com/hexrift/zentla/commit/9f79b24e62c074d196aa77d4a6fc23cb60d874e7))
* add feedback system and improve dashboard sync UX ([#21](https://github.com/hexrift/zentla/issues/21)) ([c02cbfb](https://github.com/hexrift/zentla/commit/c02cbfb21a5eb661a648ffc6fdc432b178f73471))
* add Google Search Console verification ([6e55ea6](https://github.com/hexrift/zentla/commit/6e55ea666b36c9aefca82dbe456081762e7b3281))
* add Google Search Console verification ([226425a](https://github.com/hexrift/zentla/commit/226425a99e9e008696aaf7c6167558938af9a53d))
* Add headless checkout, events tracking, and audit logs ([0898fcf](https://github.com/hexrift/zentla/commit/0898fcf5d6e9368b368c17f26d12aa6c79479990))
* add infra ([f34e3eb](https://github.com/hexrift/zentla/commit/f34e3eb5cacfabe19437ce4bb873e9222beabd71))
* add migration for usage models ([#73](https://github.com/hexrift/zentla/issues/73)) ([7735252](https://github.com/hexrift/zentla/commit/77352528c5a7fc4e5805a817b62b90921a0ea24c))
* Add scheduled offers, promotions, and API documentation ([7203a54](https://github.com/hexrift/zentla/commit/7203a546239f407a96e1313914c3ef128e416dae))
* add visible FAQ section to homepage ([a52d18c](https://github.com/hexrift/zentla/commit/a52d18c6502bcbd32a661e66fb6733fe26e36c01))
* add webhook prevention measures and setup dashboard ([#16](https://github.com/hexrift/zentla/issues/16)) ([65c1fec](https://github.com/hexrift/zentla/commit/65c1fecf6e74946f4d56725cece1fef73947ab69))
* add Zuora settings config and centralized versioning ([#33](https://github.com/hexrift/zentla/issues/33)) ([dc18c28](https://github.com/hexrift/zentla/commit/dc18c287178159385039a0a2ab889dced2f9a761))
* **admin-ui:** Add promotions pages and fix data display ([7c00675](https://github.com/hexrift/zentla/commit/7c00675e52f6d533cef7b90366034c56a63e7091))
* **admin-ui:** add shared button style classes ([#30](https://github.com/hexrift/zentla/issues/30)) ([c260a39](https://github.com/hexrift/zentla/commit/c260a392b8c7af7eca41565e6d297b336b200d25))
* **admin-ui:** convert feedback modal to dedicated page ([#25](https://github.com/hexrift/zentla/issues/25)) ([1ff4d44](https://github.com/hexrift/zentla/commit/1ff4d44ff51c973940e653bca94ea18556bdeec6))
* **api:** add ETag support and update URLs ([7113a62](https://github.com/hexrift/zentla/commit/7113a62cf04d8fcb72d19488112dbf8603f23895))
* **api:** add ETag support and update URLs ([a8ac088](https://github.com/hexrift/zentla/commit/a8ac088619ce68c4eca5ab122d7c4c8deed541f5))
* **api:** Add provider status endpoint and shared OpenAPI schemas ([494f58b](https://github.com/hexrift/zentla/commit/494f58b9806319c3386258c04a2d92351a03f649))
* **api:** add rate limit headers to API responses ([534eba1](https://github.com/hexrift/zentla/commit/534eba195621cc4875237b59efbfa9b4eb2e7f19))
* **api:** add rate limit headers to API responses ([a647f3f](https://github.com/hexrift/zentla/commit/a647f3fd4bd0e9424d64323c823d454c75612c32))
* **api:** complete API hardening for public beta ([433dc02](https://github.com/hexrift/zentla/commit/433dc02567b415a629450b957c631155a8d47414))
* **api:** Harden API for public beta ([de9e8f9](https://github.com/hexrift/zentla/commit/de9e8f9f92295bce4e606a9d68318e011dcbd19e))
* **audit:** add automatic audit logging with PII anonymization ([2019dbb](https://github.com/hexrift/zentla/commit/2019dbb975452f94237033e80926574339381f12))
* **ci:** add release-please for automated versioning ([d002a80](https://github.com/hexrift/zentla/commit/d002a80bae6d3a4ff230261d81e20382bd183f4a))
* complete rebrand from Relay to Zentla ([c16e1b9](https://github.com/hexrift/zentla/commit/c16e1b93a9ca12484a7b0018e27d3bfd9f749fa8))
* Complete rebrand from Relay to Zentla ([d2f5523](https://github.com/hexrift/zentla/commit/d2f55231e7795a76134f47ec97b54baad23e4cb2))
* Complete Stripe checkout flow with webhook handling ([81b1d2c](https://github.com/hexrift/zentla/commit/81b1d2c4b5af17d857352a4bc71441e4889cfe5c))
* Demo readiness - lifecycle wiring, docs, and Scalar API reference ([1f643c9](https://github.com/hexrift/zentla/commit/1f643c9afbf64ce75800d75eab67bbafad78f350))
* **deploy:** add free-tier deployment workflows ([#5](https://github.com/hexrift/zentla/issues/5)) ([54e8966](https://github.com/hexrift/zentla/commit/54e8966636635e80eefb80625986fbad8125a0bb))
* finalise for beta ([7b944f2](https://github.com/hexrift/zentla/commit/7b944f27728d6aa49ed3030b897a4ca6ff1d7693))
* GitHub issues for feedback/contact forms + Zuora logo update ([#38](https://github.com/hexrift/zentla/issues/38)) ([d127f73](https://github.com/hexrift/zentla/commit/d127f73ce4fe0cf74db3caeefbe19d04ad5ce4d6))
* implement per-workspace billing provider configuration ([#23](https://github.com/hexrift/zentla/issues/23)) ([a8f124e](https://github.com/hexrift/zentla/commit/a8f124e37937130a1ac213dd391b8c327be07c2b))
* implement strategic moat features ([#69](https://github.com/hexrift/zentla/issues/69)) ([da43243](https://github.com/hexrift/zentla/commit/da432431f54f486eeda09a218d16408939022b8e))
* production readiness improvements ([ac7a4e8](https://github.com/hexrift/zentla/commit/ac7a4e83654ca41c5dd0d86712559e8b565caa59))
* replace Stripe status terminology with Zentla-native terms ([c210095](https://github.com/hexrift/zentla/commit/c21009590fb5996bc7efc1d506e0df1b613781e5))
* replace Stripe status terminology with Zentla-native terms ([5f62a71](https://github.com/hexrift/zentla/commit/5f62a712ef1c4e06e182ee5af4bab97c8d454346))
* **seo:** add FAQ structured data for rich snippets ([72ad3b1](https://github.com/hexrift/zentla/commit/72ad3b1f1623b3244ce978cbfab8ef664a3c2213))
* **seo:** improve SEO to 9-10/10 rating ([7e08caa](https://github.com/hexrift/zentla/commit/7e08caa0c8ce48bb25e66f1b6e74f9023d982a41))
* **web:** add company contact page ([#29](https://github.com/hexrift/zentla/issues/29)) ([83a8a80](https://github.com/hexrift/zentla/commit/83a8a80f66f098a49824ae504d1d12021e8a0e51))
* **web:** add public feedback page and remove GitHub issues links ([#26](https://github.com/hexrift/zentla/issues/26)) ([9d540a6](https://github.com/hexrift/zentla/commit/9d540a66f63a75cccf0fc080000809d86307b409))
* **web:** add SEO improvements for search engine visibility ([#36](https://github.com/hexrift/zentla/issues/36)) ([b211a65](https://github.com/hexrift/zentla/commit/b211a65a697bacfeff2114e476b35695de5e246b))
* **web:** polish landing page with How it Works and Integrations sections ([8104117](https://github.com/hexrift/zentla/commit/81041179427bdbd640d3fb2ece76da7dfe0c09e7))
* **web:** polish landing page with How it Works and Integrations sections ([5fcaf73](https://github.com/hexrift/zentla/commit/5fcaf734c958d1d66ecdeec68da1e82d7e535b80))
* **zuora:** implement Zuora billing provider adapter ([7b843ac](https://github.com/hexrift/zentla/commit/7b843ac39f286c9a7f882c4304eb42edcd26d15f))
* **zuora:** implement Zuora billing provider adapter ([3a9c47f](https://github.com/hexrift/zentla/commit/3a9c47ffe96f39d3100043db15a92d1b0c8fd876))


### Bug Fixes

* add API_URL env var to Koyeb deployment ([3242421](https://github.com/hexrift/zentla/commit/3242421eb0cf84ae08043ba1b24b6c81ec397d45))
* add database migration step to deploy workflow ([5c329c3](https://github.com/hexrift/zentla/commit/5c329c36e6a9597530b581ed7b4d040118f8ec70))
* add Google verification to static HTML ([3fe06bf](https://github.com/hexrift/zentla/commit/3fe06bf84b3b09af6e56d1469ec1eaef8434357d))
* add Google verification to static HTML ([bff697e](https://github.com/hexrift/zentla/commit/bff697ebcc793184b657624e1e8cd5f984d7a645))
* add OpenSSL support for Prisma in Alpine Docker image ([#11](https://github.com/hexrift/zentla/issues/11)) ([b74cf76](https://github.com/hexrift/zentla/commit/b74cf767d9521aa6ad3468079c4d2f8dbea7148e))
* add prisma generate before build in release workflow ([e271916](https://github.com/hexrift/zentla/commit/e27191661a55047b1544018b5543ae464ca1960f))
* add robots.txt to block admin-ui from search engines ([23f24b4](https://github.com/hexrift/zentla/commit/23f24b4c7e99ad85203db73a3463ea00f1a3fea7))
* **admin-ui:** standardize colors to primary palette ([#28](https://github.com/hexrift/zentla/issues/28)) ([7075486](https://github.com/hexrift/zentla/commit/707548664b7a465e15820e5a8f4041a89cfcabbf))
* allow Scalar CDN in CSP for API docs ([#19](https://github.com/hexrift/zentla/issues/19)) ([cc9303c](https://github.com/hexrift/zentla/commit/cc9303c43621f4c04ce00f794c43552d193774a3))
* **api:** allow empty string for Stripe env vars ([caaef47](https://github.com/hexrift/zentla/commit/caaef47c0f02ba46ad118f4cfc3d466a819f593f))
* **api:** allow empty string for Stripe env vars ([5264cda](https://github.com/hexrift/zentla/commit/5264cda3ce0180089ad7fc8d619dd2a1869ef2b5))
* **api:** eliminate idempotency race condition ([35499d5](https://github.com/hexrift/zentla/commit/35499d5e051c239209f46532a5d19882ed1ca692))
* **api:** eliminate idempotency race condition with create-first pattern ([4be688e](https://github.com/hexrift/zentla/commit/4be688eea772108e0cb9a5c67bb91bd1e8b7e33b))
* **api:** invalidate entitlement cache on revocation ([43fef24](https://github.com/hexrift/zentla/commit/43fef2477a38616097b206382659e738c472bc98))
* **api:** invalidate entitlement cache on revocation ([d99ccc4](https://github.com/hexrift/zentla/commit/d99ccc42fbc6fdbb48e050068d4c255f52a79bea))
* **api:** make OpenAPI server URL configurable ([#27](https://github.com/hexrift/zentla/issues/27)) ([76cfc40](https://github.com/hexrift/zentla/commit/76cfc409498da087ed677aac251994d230e6ed5e))
* **api:** make STRIPE_SECRET_KEY optional in all environments ([75498f1](https://github.com/hexrift/zentla/commit/75498f1b543fa9cd121a4fa92404b6eda9844d49))
* **api:** make STRIPE_SECRET_KEY optional in all environments ([15ed686](https://github.com/hexrift/zentla/commit/15ed68610825d6abf6197a67cfa2d432322738a0))
* **api:** rename checkout url field to sessionUrl for schema consistency ([8911918](https://github.com/hexrift/zentla/commit/8911918f8c45076d2a7e6f64fdd51c0ee9e44508))
* **api:** rename checkout url field to sessionUrl for schema consistency ([6519bf8](https://github.com/hexrift/zentla/commit/6519bf8bb052d2190f50eb9991f61feae1b1812e))
* **api:** return 200 for POST /quotes endpoint ([671337c](https://github.com/hexrift/zentla/commit/671337cfe4ca23fd48056edd31e0fe4dee659c2e))
* **api:** return 200 for POST /quotes endpoint ([fee329f](https://github.com/hexrift/zentla/commit/fee329f40bcf4f1a1d6bdaa7b6dd75aca889b459))
* **api:** update theme color and Zuora messaging ([b5a8fa7](https://github.com/hexrift/zentla/commit/b5a8fa7a00e242977a58f900d36edd7ffc6e6a76))
* apply Prettier formatting ([c626333](https://github.com/hexrift/zentla/commit/c626333c720b2364ad53059761f955d79c9f6854))
* **build:** update yarn workspaces foreach for Yarn 4 compatibility ([979e507](https://github.com/hexrift/zentla/commit/979e5075c90c241e6f59a008ef433c01240f088f))
* **ci:** add ESLint config for api package and fix PR validation ([2e0eb5a](https://github.com/hexrift/zentla/commit/2e0eb5a6a8694e20bfb0274137b29fe83094357b))
* **ci:** add permissions to PR automation workflow jobs ([3bb2789](https://github.com/hexrift/zentla/commit/3bb278973c7dbfafb4bdb950d711fc002a98f2de))
* **ci:** enable Corepack for Yarn 4 compatibility ([9830edf](https://github.com/hexrift/zentla/commit/9830edf888230c4aa945f17067d6cbccc1beb0d2))
* **ci:** resolve ESLint, TypeScript, and test errors ([f9daced](https://github.com/hexrift/zentla/commit/f9daced58f938b8198b18225406b1ea431db3787))
* complete rebrand cleanup (Relay → Zentla) ([a13f9a6](https://github.com/hexrift/zentla/commit/a13f9a6e911b10d371c61193c9e76944e2a8989c))
* Complete rebrand cleanup (Relay → Zentla) ([64ce2c8](https://github.com/hexrift/zentla/commit/64ce2c8cf9bf1fa9fcfa79163e8dfd45f28a32c2))
* complete Relay → Zentla rebrand across codebase ([d24431b](https://github.com/hexrift/zentla/commit/d24431bfc430839ce494b19bf1a8c11851512cc1))
* correct Koyeb app/service naming ([#20](https://github.com/hexrift/zentla/issues/20)) ([359bcdf](https://github.com/hexrift/zentla/commit/359bcdf3eccc40dbaa07584aafee9c2536e16df2))
* dashboard stripe check and remove webhook endpoint field ([#18](https://github.com/hexrift/zentla/issues/18)) ([c8213df](https://github.com/hexrift/zentla/commit/c8213df853d85c456250c2d8fbc5c99ca10e36c7))
* **db:** correct migration order for processed_provider_event ([93f60ab](https://github.com/hexrift/zentla/commit/93f60ab7bdf23d12527cdea2153ae8806e5d9cb9))
* **deploy:** correct health check path and add user tables migration ([#12](https://github.com/hexrift/zentla/issues/12)) ([9c1b6ca](https://github.com/hexrift/zentla/commit/9c1b6caa498c575cce43ef369d7e4035c4ec9b1f))
* **deploy:** correct health check path to /api/health ([#10](https://github.com/hexrift/zentla/issues/10)) ([1680a1f](https://github.com/hexrift/zentla/commit/1680a1f9012cc978d43e3406e7214c1946940348))
* **deploy:** correct Koyeb CLI flags ([#8](https://github.com/hexrift/zentla/issues/8)) ([b48a0e5](https://github.com/hexrift/zentla/commit/b48a0e53dce0720158974f66b58e1d424b6d7b2a))
* **deploy:** use curl to install Koyeb CLI and add missing env vars ([#7](https://github.com/hexrift/zentla/issues/7)) ([44a4d5e](https://github.com/hexrift/zentla/commit/44a4d5e9cae64dbdf4904cfed9b69d3df4a0156a))
* **docker:** build only API packages, exclude admin-ui ([69142cc](https://github.com/hexrift/zentla/commit/69142cc17be6154417d1045ec0fc38db6d8d9db0))
* **docker:** remove --immutable flag for yarn install ([a13e479](https://github.com/hexrift/zentla/commit/a13e479545197d6c5096b84202570dbc808238a2))
* **docker:** simplify for Yarn 4 hoisted node_modules ([b07dbe5](https://github.com/hexrift/zentla/commit/b07dbe55ad82aeb742a5e6d1444eb188a5dce9c5))
* **docker:** use Corepack instead of copying .yarn directory ([45f308d](https://github.com/hexrift/zentla/commit/45f308dd5e6b9a418df1ea7e7c5a4b8182e743e5))
* enable Corepack for Yarn 4 in deploy workflow ([150290b](https://github.com/hexrift/zentla/commit/150290b90a95192198e621409dc139b6a062efec))
* format SEO.tsx ([cd6165c](https://github.com/hexrift/zentla/commit/cd6165c286b485d5cb5cb49c9f47035591e3f0b9))
* ignore CHANGELOG.md in Prettier checks ([238f59c](https://github.com/hexrift/zentla/commit/238f59cde6e2301377e66eb6ff5c00c56dbd5d40))
* ignore CHANGELOG.md in Prettier checks ([0046516](https://github.com/hexrift/zentla/commit/00465161f013317f6945e70e815038ee442aa75d))
* improve release-please auto-merge with optional bypass ([0bd8d73](https://github.com/hexrift/zentla/commit/0bd8d73456e9561f2e3b8cbbff4923889e7b9253))
* improve SEO and UX ([39a988a](https://github.com/hexrift/zentla/commit/39a988ac00cbc88fc990d5c69d7cd660a2ee7222))
* **lint:** resolve remaining ESLint warnings ([409d95a](https://github.com/hexrift/zentla/commit/409d95af78722e856471a5b116945a0a5d8b3835))
* **lint:** resolve remaining ESLint warnings ([96e37c4](https://github.com/hexrift/zentla/commit/96e37c4567bcfc265625dd280fbcc1516f459b9a))
* **lint:** suppress ESLint warnings for necessary any types and namespace ([a2c9532](https://github.com/hexrift/zentla/commit/a2c9532f2f18a35e4941982cd6d98cab146dc595))
* remove buggy auto-merge from release-please workflow ([24f7227](https://github.com/hexrift/zentla/commit/24f7227c36bce2eaa31f5fd966d448f28387c236))
* remove non-existent contact options from versioning page ([1654eda](https://github.com/hexrift/zentla/commit/1654eda862b6acf1ed71fdcb3341e4ed306b58d8))
* remove remaining relay references from codebase ([1097104](https://github.com/hexrift/zentla/commit/1097104f0aa0873346bb24070594b2e96878f043))
* remove Stripe-specific terminology from user-facing areas ([#67](https://github.com/hexrift/zentla/issues/67)) ([3b0ed59](https://github.com/hexrift/zentla/commit/3b0ed59f38023445b921df53637ba93567743c2e))
* replace hardcoded purple/indigo colors with primary theme ([3098819](https://github.com/hexrift/zentla/commit/3098819a0df247561cec63af7cd7b96c09ab1deb))
* resolve release-please workflow JSON parsing error ([6135da1](https://github.com/hexrift/zentla/commit/6135da118736758e3814dc69810b0ccc0d5d5be2))
* resolve release-please workflow JSON parsing error ([df883cb](https://github.com/hexrift/zentla/commit/df883cbc5a160b1b03aa2f90312311bccdb4a1db))
* **security:** upgrade qs to 6.14.1 (CVE-2025-15284) ([343fb33](https://github.com/hexrift/zentla/commit/343fb33a1f40d239ae19342afeef5a05ea3a63cf))
* simplify release-please to versioning only ([c8ebe8c](https://github.com/hexrift/zentla/commit/c8ebe8cce8dba903af91f8935899f6ea873e923c))
* simplify Scalar API docs styling for better readability ([#35](https://github.com/hexrift/zentla/issues/35)) ([e4b6f33](https://github.com/hexrift/zentla/commit/e4b6f3367b1d9f927569d83d55f93abe1a8fa5a8))
* split status migration to avoid PostgreSQL enum transaction issue ([795f8c7](https://github.com/hexrift/zentla/commit/795f8c7ef8416037f651f01bcac5eed761145d79))
* standardize discountType terminology to use "percent" ([e75fa2e](https://github.com/hexrift/zentla/commit/e75fa2ef42161aaf0ac56220dd4d24f9dd9ba172))
* standardize terminology across codebase ([a6ba26e](https://github.com/hexrift/zentla/commit/a6ba26e2e8f4f8e67820f79722db95ef29d0ea9e))
* **test:** update test to use sessionUrl instead of url ([3d8047a](https://github.com/hexrift/zentla/commit/3d8047a732588fa2f5575db696d694d6e06307ab))
* update admin-ui theme to use primary (emerald) colors ([ac19ff3](https://github.com/hexrift/zentla/commit/ac19ff34c13c86205b518324674f21f6265cfa97))
* update branding consistency across packages ([9cea98f](https://github.com/hexrift/zentla/commit/9cea98f36ab722953e8e34e0b3a2d0e99993e98b))
* update branding consistency across packages ([02e6986](https://github.com/hexrift/zentla/commit/02e6986c066a8e7d8dd97ec279a103109a2593a3))
* update canonical URLs to zentla-web.pages.dev ([9a15695](https://github.com/hexrift/zentla/commit/9a15695595aee43b364d1379e99cac5f47487f2e))
* update Cloudflare Pages project names to zentla ([43653e2](https://github.com/hexrift/zentla/commit/43653e2a5b74dde90a4f2f82db591f273c4ce782))
* update Dockerfiles with [@zentla](https://github.com/zentla) package names ([2195d93](https://github.com/hexrift/zentla/commit/2195d930ba0f5ebc72d9e3b80f70e3efa4d1abbb))
* update docs and make wording more provider-agnostic ([75b8779](https://github.com/hexrift/zentla/commit/75b8779d535a704242fd82fae786551bbfa04e98))
* update Google verification tag ([6485796](https://github.com/hexrift/zentla/commit/6485796f7998fbd0f7a27d3074191dbd0328af25))
* update Google verification tag ([c5f46d0](https://github.com/hexrift/zentla/commit/c5f46d073af8f896a31bb949b2d16770a65e504a))
* update Koyeb app name to zentla ([d1fda4f](https://github.com/hexrift/zentla/commit/d1fda4fb4b9fb54943b044d3d54f5ea0b766850d))
* update provider availability and remove placeholder text ([#71](https://github.com/hexrift/zentla/issues/71)) ([e08fd4c](https://github.com/hexrift/zentla/commit/e08fd4c2e61d8dc2525abb5a3809a77ffcf7af1e))
* update session token prefix and fix prettier formatting ([fe671cd](https://github.com/hexrift/zentla/commit/fe671cd2cf2fa40fd7b7cb120e7c985aae3eae2c))
* update sitemap.xml and robots.txt URLs to zentla.dev ([2acdd54](https://github.com/hexrift/zentla/commit/2acdd54ab0acea7d976a5a7806ced22bcd9d62e7))
* use --admin flag for release PR merge ([736afe1](https://github.com/hexrift/zentla/commit/736afe1786dd0254de64e97757eb4d3b006c2cea))
* use --admin flag for release PR merge to bypass checks ([c6b199a](https://github.com/hexrift/zentla/commit/c6b199a2c718e0df3eb0700575720c55279df18d))
* use env vars for API URLs in admin-ui and web ([#14](https://github.com/hexrift/zentla/issues/14)) ([1034dec](https://github.com/hexrift/zentla/commit/1034deca10eb56b7efd1ccb90f41fef33dde7462))
* use env vars for dashboard/API URLs ([#13](https://github.com/hexrift/zentla/issues/13)) ([7512e89](https://github.com/hexrift/zentla/commit/7512e89be1abf37d2bb95916c1e9033f610ef2ca))
* use env vars for docs links in admin UI ([#17](https://github.com/hexrift/zentla/issues/17)) ([1905dfe](https://github.com/hexrift/zentla/commit/1905dfeb2e90fa2b7c793048ad97c3d222e03ecf))
* use generic billing terminology in dashboard checklist ([#24](https://github.com/hexrift/zentla/issues/24)) ([f9983a1](https://github.com/hexrift/zentla/commit/f9983a1551dd4d34481a628c5076b7672f0d7cee))
* use official Stripe and Zuora logos with proper attribution ([#37](https://github.com/hexrift/zentla/issues/37)) ([a442774](https://github.com/hexrift/zentla/commit/a442774dcaaa04d3ff724300c95795c9573de4d5))
* use provider status API for Settings page Stripe badge ([5ff5aa8](https://github.com/hexrift/zentla/commit/5ff5aa8e6709dd14097f52f99ae61cf84e51550f))

## [4.0.0](https://github.com/hexrift/zentla/compare/v3.0.1...v4.0.0) (2026-01-04)


### ⚠ BREAKING CHANGES

* API responses now use new status values. Existing subscriptions will be migrated via database migration.

### Features

* add checkout page to admin ui ([7a3c92b](https://github.com/hexrift/zentla/commit/7a3c92b73baec56913be88fe9189b7dcadae138b))
* Add customer portal endpoint ([48c29a6](https://github.com/hexrift/zentla/commit/48c29a64026eff433310595f2ab17a09cce9b1e6))
* add favicon and apple-touch-icon ([ee5add7](https://github.com/hexrift/zentla/commit/ee5add7a15e2a8493e45b43f509fcba90b754e2b))
* add favicon and apple-touch-icon ([9f79b24](https://github.com/hexrift/zentla/commit/9f79b24e62c074d196aa77d4a6fc23cb60d874e7))
* add feedback system and improve dashboard sync UX ([#21](https://github.com/hexrift/zentla/issues/21)) ([c02cbfb](https://github.com/hexrift/zentla/commit/c02cbfb21a5eb661a648ffc6fdc432b178f73471))
* add Google Search Console verification ([6e55ea6](https://github.com/hexrift/zentla/commit/6e55ea666b36c9aefca82dbe456081762e7b3281))
* add Google Search Console verification ([226425a](https://github.com/hexrift/zentla/commit/226425a99e9e008696aaf7c6167558938af9a53d))
* Add headless checkout, events tracking, and audit logs ([0898fcf](https://github.com/hexrift/zentla/commit/0898fcf5d6e9368b368c17f26d12aa6c79479990))
* add infra ([f34e3eb](https://github.com/hexrift/zentla/commit/f34e3eb5cacfabe19437ce4bb873e9222beabd71))
* add migration for usage models ([#73](https://github.com/hexrift/zentla/issues/73)) ([7735252](https://github.com/hexrift/zentla/commit/77352528c5a7fc4e5805a817b62b90921a0ea24c))
* Add scheduled offers, promotions, and API documentation ([7203a54](https://github.com/hexrift/zentla/commit/7203a546239f407a96e1313914c3ef128e416dae))
* add visible FAQ section to homepage ([a52d18c](https://github.com/hexrift/zentla/commit/a52d18c6502bcbd32a661e66fb6733fe26e36c01))
* add webhook prevention measures and setup dashboard ([#16](https://github.com/hexrift/zentla/issues/16)) ([65c1fec](https://github.com/hexrift/zentla/commit/65c1fecf6e74946f4d56725cece1fef73947ab69))
* add Zuora settings config and centralized versioning ([#33](https://github.com/hexrift/zentla/issues/33)) ([dc18c28](https://github.com/hexrift/zentla/commit/dc18c287178159385039a0a2ab889dced2f9a761))
* **admin-ui:** Add promotions pages and fix data display ([7c00675](https://github.com/hexrift/zentla/commit/7c00675e52f6d533cef7b90366034c56a63e7091))
* **admin-ui:** add shared button style classes ([#30](https://github.com/hexrift/zentla/issues/30)) ([c260a39](https://github.com/hexrift/zentla/commit/c260a392b8c7af7eca41565e6d297b336b200d25))
* **admin-ui:** convert feedback modal to dedicated page ([#25](https://github.com/hexrift/zentla/issues/25)) ([1ff4d44](https://github.com/hexrift/zentla/commit/1ff4d44ff51c973940e653bca94ea18556bdeec6))
* **api:** add ETag support and update URLs ([7113a62](https://github.com/hexrift/zentla/commit/7113a62cf04d8fcb72d19488112dbf8603f23895))
* **api:** add ETag support and update URLs ([a8ac088](https://github.com/hexrift/zentla/commit/a8ac088619ce68c4eca5ab122d7c4c8deed541f5))
* **api:** Add provider status endpoint and shared OpenAPI schemas ([494f58b](https://github.com/hexrift/zentla/commit/494f58b9806319c3386258c04a2d92351a03f649))
* **api:** add rate limit headers to API responses ([534eba1](https://github.com/hexrift/zentla/commit/534eba195621cc4875237b59efbfa9b4eb2e7f19))
* **api:** add rate limit headers to API responses ([a647f3f](https://github.com/hexrift/zentla/commit/a647f3fd4bd0e9424d64323c823d454c75612c32))
* **api:** complete API hardening for public beta ([433dc02](https://github.com/hexrift/zentla/commit/433dc02567b415a629450b957c631155a8d47414))
* **api:** Harden API for public beta ([de9e8f9](https://github.com/hexrift/zentla/commit/de9e8f9f92295bce4e606a9d68318e011dcbd19e))
* **audit:** add automatic audit logging with PII anonymization ([2019dbb](https://github.com/hexrift/zentla/commit/2019dbb975452f94237033e80926574339381f12))
* **ci:** add release-please for automated versioning ([d002a80](https://github.com/hexrift/zentla/commit/d002a80bae6d3a4ff230261d81e20382bd183f4a))
* complete rebrand from Relay to Zentla ([c16e1b9](https://github.com/hexrift/zentla/commit/c16e1b93a9ca12484a7b0018e27d3bfd9f749fa8))
* Complete rebrand from Relay to Zentla ([d2f5523](https://github.com/hexrift/zentla/commit/d2f55231e7795a76134f47ec97b54baad23e4cb2))
* Complete Stripe checkout flow with webhook handling ([81b1d2c](https://github.com/hexrift/zentla/commit/81b1d2c4b5af17d857352a4bc71441e4889cfe5c))
* Demo readiness - lifecycle wiring, docs, and Scalar API reference ([1f643c9](https://github.com/hexrift/zentla/commit/1f643c9afbf64ce75800d75eab67bbafad78f350))
* **deploy:** add free-tier deployment workflows ([#5](https://github.com/hexrift/zentla/issues/5)) ([54e8966](https://github.com/hexrift/zentla/commit/54e8966636635e80eefb80625986fbad8125a0bb))
* finalise for beta ([7b944f2](https://github.com/hexrift/zentla/commit/7b944f27728d6aa49ed3030b897a4ca6ff1d7693))
* GitHub issues for feedback/contact forms + Zuora logo update ([#38](https://github.com/hexrift/zentla/issues/38)) ([d127f73](https://github.com/hexrift/zentla/commit/d127f73ce4fe0cf74db3caeefbe19d04ad5ce4d6))
* implement per-workspace billing provider configuration ([#23](https://github.com/hexrift/zentla/issues/23)) ([a8f124e](https://github.com/hexrift/zentla/commit/a8f124e37937130a1ac213dd391b8c327be07c2b))
* implement strategic moat features ([#69](https://github.com/hexrift/zentla/issues/69)) ([da43243](https://github.com/hexrift/zentla/commit/da432431f54f486eeda09a218d16408939022b8e))
* production readiness improvements ([ac7a4e8](https://github.com/hexrift/zentla/commit/ac7a4e83654ca41c5dd0d86712559e8b565caa59))
* replace Stripe status terminology with Zentla-native terms ([c210095](https://github.com/hexrift/zentla/commit/c21009590fb5996bc7efc1d506e0df1b613781e5))
* replace Stripe status terminology with Zentla-native terms ([5f62a71](https://github.com/hexrift/zentla/commit/5f62a712ef1c4e06e182ee5af4bab97c8d454346))
* **seo:** add FAQ structured data for rich snippets ([72ad3b1](https://github.com/hexrift/zentla/commit/72ad3b1f1623b3244ce978cbfab8ef664a3c2213))
* **seo:** improve SEO to 9-10/10 rating ([7e08caa](https://github.com/hexrift/zentla/commit/7e08caa0c8ce48bb25e66f1b6e74f9023d982a41))
* **web:** add company contact page ([#29](https://github.com/hexrift/zentla/issues/29)) ([83a8a80](https://github.com/hexrift/zentla/commit/83a8a80f66f098a49824ae504d1d12021e8a0e51))
* **web:** add public feedback page and remove GitHub issues links ([#26](https://github.com/hexrift/zentla/issues/26)) ([9d540a6](https://github.com/hexrift/zentla/commit/9d540a66f63a75cccf0fc080000809d86307b409))
* **web:** add SEO improvements for search engine visibility ([#36](https://github.com/hexrift/zentla/issues/36)) ([b211a65](https://github.com/hexrift/zentla/commit/b211a65a697bacfeff2114e476b35695de5e246b))
* **web:** polish landing page with How it Works and Integrations sections ([8104117](https://github.com/hexrift/zentla/commit/81041179427bdbd640d3fb2ece76da7dfe0c09e7))
* **web:** polish landing page with How it Works and Integrations sections ([5fcaf73](https://github.com/hexrift/zentla/commit/5fcaf734c958d1d66ecdeec68da1e82d7e535b80))
* **zuora:** implement Zuora billing provider adapter ([7b843ac](https://github.com/hexrift/zentla/commit/7b843ac39f286c9a7f882c4304eb42edcd26d15f))
* **zuora:** implement Zuora billing provider adapter ([3a9c47f](https://github.com/hexrift/zentla/commit/3a9c47ffe96f39d3100043db15a92d1b0c8fd876))


### Bug Fixes

* add API_URL env var to Koyeb deployment ([3242421](https://github.com/hexrift/zentla/commit/3242421eb0cf84ae08043ba1b24b6c81ec397d45))
* add database migration step to deploy workflow ([5c329c3](https://github.com/hexrift/zentla/commit/5c329c36e6a9597530b581ed7b4d040118f8ec70))
* add Google verification to static HTML ([3fe06bf](https://github.com/hexrift/zentla/commit/3fe06bf84b3b09af6e56d1469ec1eaef8434357d))
* add Google verification to static HTML ([bff697e](https://github.com/hexrift/zentla/commit/bff697ebcc793184b657624e1e8cd5f984d7a645))
* add OpenSSL support for Prisma in Alpine Docker image ([#11](https://github.com/hexrift/zentla/issues/11)) ([b74cf76](https://github.com/hexrift/zentla/commit/b74cf767d9521aa6ad3468079c4d2f8dbea7148e))
* add prisma generate before build in release workflow ([e271916](https://github.com/hexrift/zentla/commit/e27191661a55047b1544018b5543ae464ca1960f))
* add robots.txt to block admin-ui from search engines ([23f24b4](https://github.com/hexrift/zentla/commit/23f24b4c7e99ad85203db73a3463ea00f1a3fea7))
* **admin-ui:** standardize colors to primary palette ([#28](https://github.com/hexrift/zentla/issues/28)) ([7075486](https://github.com/hexrift/zentla/commit/707548664b7a465e15820e5a8f4041a89cfcabbf))
* allow Scalar CDN in CSP for API docs ([#19](https://github.com/hexrift/zentla/issues/19)) ([cc9303c](https://github.com/hexrift/zentla/commit/cc9303c43621f4c04ce00f794c43552d193774a3))
* **api:** allow empty string for Stripe env vars ([caaef47](https://github.com/hexrift/zentla/commit/caaef47c0f02ba46ad118f4cfc3d466a819f593f))
* **api:** allow empty string for Stripe env vars ([5264cda](https://github.com/hexrift/zentla/commit/5264cda3ce0180089ad7fc8d619dd2a1869ef2b5))
* **api:** eliminate idempotency race condition ([35499d5](https://github.com/hexrift/zentla/commit/35499d5e051c239209f46532a5d19882ed1ca692))
* **api:** eliminate idempotency race condition with create-first pattern ([4be688e](https://github.com/hexrift/zentla/commit/4be688eea772108e0cb9a5c67bb91bd1e8b7e33b))
* **api:** invalidate entitlement cache on revocation ([43fef24](https://github.com/hexrift/zentla/commit/43fef2477a38616097b206382659e738c472bc98))
* **api:** invalidate entitlement cache on revocation ([d99ccc4](https://github.com/hexrift/zentla/commit/d99ccc42fbc6fdbb48e050068d4c255f52a79bea))
* **api:** make OpenAPI server URL configurable ([#27](https://github.com/hexrift/zentla/issues/27)) ([76cfc40](https://github.com/hexrift/zentla/commit/76cfc409498da087ed677aac251994d230e6ed5e))
* **api:** make STRIPE_SECRET_KEY optional in all environments ([75498f1](https://github.com/hexrift/zentla/commit/75498f1b543fa9cd121a4fa92404b6eda9844d49))
* **api:** make STRIPE_SECRET_KEY optional in all environments ([15ed686](https://github.com/hexrift/zentla/commit/15ed68610825d6abf6197a67cfa2d432322738a0))
* **api:** rename checkout url field to sessionUrl for schema consistency ([8911918](https://github.com/hexrift/zentla/commit/8911918f8c45076d2a7e6f64fdd51c0ee9e44508))
* **api:** rename checkout url field to sessionUrl for schema consistency ([6519bf8](https://github.com/hexrift/zentla/commit/6519bf8bb052d2190f50eb9991f61feae1b1812e))
* **api:** return 200 for POST /quotes endpoint ([671337c](https://github.com/hexrift/zentla/commit/671337cfe4ca23fd48056edd31e0fe4dee659c2e))
* **api:** return 200 for POST /quotes endpoint ([fee329f](https://github.com/hexrift/zentla/commit/fee329f40bcf4f1a1d6bdaa7b6dd75aca889b459))
* **api:** update theme color and Zuora messaging ([b5a8fa7](https://github.com/hexrift/zentla/commit/b5a8fa7a00e242977a58f900d36edd7ffc6e6a76))
* apply Prettier formatting ([c626333](https://github.com/hexrift/zentla/commit/c626333c720b2364ad53059761f955d79c9f6854))
* **build:** update yarn workspaces foreach for Yarn 4 compatibility ([979e507](https://github.com/hexrift/zentla/commit/979e5075c90c241e6f59a008ef433c01240f088f))
* **ci:** add ESLint config for api package and fix PR validation ([2e0eb5a](https://github.com/hexrift/zentla/commit/2e0eb5a6a8694e20bfb0274137b29fe83094357b))
* **ci:** add permissions to PR automation workflow jobs ([3bb2789](https://github.com/hexrift/zentla/commit/3bb278973c7dbfafb4bdb950d711fc002a98f2de))
* **ci:** enable Corepack for Yarn 4 compatibility ([9830edf](https://github.com/hexrift/zentla/commit/9830edf888230c4aa945f17067d6cbccc1beb0d2))
* **ci:** resolve ESLint, TypeScript, and test errors ([f9daced](https://github.com/hexrift/zentla/commit/f9daced58f938b8198b18225406b1ea431db3787))
* complete rebrand cleanup (Relay → Zentla) ([a13f9a6](https://github.com/hexrift/zentla/commit/a13f9a6e911b10d371c61193c9e76944e2a8989c))
* Complete rebrand cleanup (Relay → Zentla) ([64ce2c8](https://github.com/hexrift/zentla/commit/64ce2c8cf9bf1fa9fcfa79163e8dfd45f28a32c2))
* complete Relay → Zentla rebrand across codebase ([d24431b](https://github.com/hexrift/zentla/commit/d24431bfc430839ce494b19bf1a8c11851512cc1))
* correct Koyeb app/service naming ([#20](https://github.com/hexrift/zentla/issues/20)) ([359bcdf](https://github.com/hexrift/zentla/commit/359bcdf3eccc40dbaa07584aafee9c2536e16df2))
* dashboard stripe check and remove webhook endpoint field ([#18](https://github.com/hexrift/zentla/issues/18)) ([c8213df](https://github.com/hexrift/zentla/commit/c8213df853d85c456250c2d8fbc5c99ca10e36c7))
* **db:** correct migration order for processed_provider_event ([93f60ab](https://github.com/hexrift/zentla/commit/93f60ab7bdf23d12527cdea2153ae8806e5d9cb9))
* **deploy:** correct health check path and add user tables migration ([#12](https://github.com/hexrift/zentla/issues/12)) ([9c1b6ca](https://github.com/hexrift/zentla/commit/9c1b6caa498c575cce43ef369d7e4035c4ec9b1f))
* **deploy:** correct health check path to /api/health ([#10](https://github.com/hexrift/zentla/issues/10)) ([1680a1f](https://github.com/hexrift/zentla/commit/1680a1f9012cc978d43e3406e7214c1946940348))
* **deploy:** correct Koyeb CLI flags ([#8](https://github.com/hexrift/zentla/issues/8)) ([b48a0e5](https://github.com/hexrift/zentla/commit/b48a0e53dce0720158974f66b58e1d424b6d7b2a))
* **deploy:** use curl to install Koyeb CLI and add missing env vars ([#7](https://github.com/hexrift/zentla/issues/7)) ([44a4d5e](https://github.com/hexrift/zentla/commit/44a4d5e9cae64dbdf4904cfed9b69d3df4a0156a))
* **docker:** build only API packages, exclude admin-ui ([69142cc](https://github.com/hexrift/zentla/commit/69142cc17be6154417d1045ec0fc38db6d8d9db0))
* **docker:** remove --immutable flag for yarn install ([a13e479](https://github.com/hexrift/zentla/commit/a13e479545197d6c5096b84202570dbc808238a2))
* **docker:** simplify for Yarn 4 hoisted node_modules ([b07dbe5](https://github.com/hexrift/zentla/commit/b07dbe55ad82aeb742a5e6d1444eb188a5dce9c5))
* **docker:** use Corepack instead of copying .yarn directory ([45f308d](https://github.com/hexrift/zentla/commit/45f308dd5e6b9a418df1ea7e7c5a4b8182e743e5))
* enable Corepack for Yarn 4 in deploy workflow ([150290b](https://github.com/hexrift/zentla/commit/150290b90a95192198e621409dc139b6a062efec))
* format SEO.tsx ([cd6165c](https://github.com/hexrift/zentla/commit/cd6165c286b485d5cb5cb49c9f47035591e3f0b9))
* ignore CHANGELOG.md in Prettier checks ([238f59c](https://github.com/hexrift/zentla/commit/238f59cde6e2301377e66eb6ff5c00c56dbd5d40))
* ignore CHANGELOG.md in Prettier checks ([0046516](https://github.com/hexrift/zentla/commit/00465161f013317f6945e70e815038ee442aa75d))
* improve release-please auto-merge with optional bypass ([0bd8d73](https://github.com/hexrift/zentla/commit/0bd8d73456e9561f2e3b8cbbff4923889e7b9253))
* improve SEO and UX ([39a988a](https://github.com/hexrift/zentla/commit/39a988ac00cbc88fc990d5c69d7cd660a2ee7222))
* **lint:** resolve remaining ESLint warnings ([409d95a](https://github.com/hexrift/zentla/commit/409d95af78722e856471a5b116945a0a5d8b3835))
* **lint:** resolve remaining ESLint warnings ([96e37c4](https://github.com/hexrift/zentla/commit/96e37c4567bcfc265625dd280fbcc1516f459b9a))
* **lint:** suppress ESLint warnings for necessary any types and namespace ([a2c9532](https://github.com/hexrift/zentla/commit/a2c9532f2f18a35e4941982cd6d98cab146dc595))
* remove buggy auto-merge from release-please workflow ([24f7227](https://github.com/hexrift/zentla/commit/24f7227c36bce2eaa31f5fd966d448f28387c236))
* remove non-existent contact options from versioning page ([1654eda](https://github.com/hexrift/zentla/commit/1654eda862b6acf1ed71fdcb3341e4ed306b58d8))
* remove remaining relay references from codebase ([1097104](https://github.com/hexrift/zentla/commit/1097104f0aa0873346bb24070594b2e96878f043))
* remove Stripe-specific terminology from user-facing areas ([#67](https://github.com/hexrift/zentla/issues/67)) ([3b0ed59](https://github.com/hexrift/zentla/commit/3b0ed59f38023445b921df53637ba93567743c2e))
* replace hardcoded purple/indigo colors with primary theme ([3098819](https://github.com/hexrift/zentla/commit/3098819a0df247561cec63af7cd7b96c09ab1deb))
* resolve release-please workflow JSON parsing error ([6135da1](https://github.com/hexrift/zentla/commit/6135da118736758e3814dc69810b0ccc0d5d5be2))
* resolve release-please workflow JSON parsing error ([df883cb](https://github.com/hexrift/zentla/commit/df883cbc5a160b1b03aa2f90312311bccdb4a1db))
* **security:** upgrade qs to 6.14.1 (CVE-2025-15284) ([343fb33](https://github.com/hexrift/zentla/commit/343fb33a1f40d239ae19342afeef5a05ea3a63cf))
* simplify release-please to versioning only ([c8ebe8c](https://github.com/hexrift/zentla/commit/c8ebe8cce8dba903af91f8935899f6ea873e923c))
* simplify Scalar API docs styling for better readability ([#35](https://github.com/hexrift/zentla/issues/35)) ([e4b6f33](https://github.com/hexrift/zentla/commit/e4b6f3367b1d9f927569d83d55f93abe1a8fa5a8))
* split status migration to avoid PostgreSQL enum transaction issue ([795f8c7](https://github.com/hexrift/zentla/commit/795f8c7ef8416037f651f01bcac5eed761145d79))
* standardize discountType terminology to use "percent" ([e75fa2e](https://github.com/hexrift/zentla/commit/e75fa2ef42161aaf0ac56220dd4d24f9dd9ba172))
* standardize terminology across codebase ([a6ba26e](https://github.com/hexrift/zentla/commit/a6ba26e2e8f4f8e67820f79722db95ef29d0ea9e))
* **test:** update test to use sessionUrl instead of url ([3d8047a](https://github.com/hexrift/zentla/commit/3d8047a732588fa2f5575db696d694d6e06307ab))
* update admin-ui theme to use primary (emerald) colors ([ac19ff3](https://github.com/hexrift/zentla/commit/ac19ff34c13c86205b518324674f21f6265cfa97))
* update branding consistency across packages ([9cea98f](https://github.com/hexrift/zentla/commit/9cea98f36ab722953e8e34e0b3a2d0e99993e98b))
* update branding consistency across packages ([02e6986](https://github.com/hexrift/zentla/commit/02e6986c066a8e7d8dd97ec279a103109a2593a3))
* update canonical URLs to zentla-web.pages.dev ([9a15695](https://github.com/hexrift/zentla/commit/9a15695595aee43b364d1379e99cac5f47487f2e))
* update Cloudflare Pages project names to zentla ([43653e2](https://github.com/hexrift/zentla/commit/43653e2a5b74dde90a4f2f82db591f273c4ce782))
* update Dockerfiles with [@zentla](https://github.com/zentla) package names ([2195d93](https://github.com/hexrift/zentla/commit/2195d930ba0f5ebc72d9e3b80f70e3efa4d1abbb))
* update docs and make wording more provider-agnostic ([75b8779](https://github.com/hexrift/zentla/commit/75b8779d535a704242fd82fae786551bbfa04e98))
* update Google verification tag ([6485796](https://github.com/hexrift/zentla/commit/6485796f7998fbd0f7a27d3074191dbd0328af25))
* update Google verification tag ([c5f46d0](https://github.com/hexrift/zentla/commit/c5f46d073af8f896a31bb949b2d16770a65e504a))
* update Koyeb app name to zentla ([d1fda4f](https://github.com/hexrift/zentla/commit/d1fda4fb4b9fb54943b044d3d54f5ea0b766850d))
* update provider availability and remove placeholder text ([#71](https://github.com/hexrift/zentla/issues/71)) ([e08fd4c](https://github.com/hexrift/zentla/commit/e08fd4c2e61d8dc2525abb5a3809a77ffcf7af1e))
* update session token prefix and fix prettier formatting ([fe671cd](https://github.com/hexrift/zentla/commit/fe671cd2cf2fa40fd7b7cb120e7c985aae3eae2c))
* update sitemap.xml and robots.txt URLs to zentla.dev ([2acdd54](https://github.com/hexrift/zentla/commit/2acdd54ab0acea7d976a5a7806ced22bcd9d62e7))
* use --admin flag for release PR merge ([736afe1](https://github.com/hexrift/zentla/commit/736afe1786dd0254de64e97757eb4d3b006c2cea))
* use --admin flag for release PR merge to bypass checks ([c6b199a](https://github.com/hexrift/zentla/commit/c6b199a2c718e0df3eb0700575720c55279df18d))
* use env vars for API URLs in admin-ui and web ([#14](https://github.com/hexrift/zentla/issues/14)) ([1034dec](https://github.com/hexrift/zentla/commit/1034deca10eb56b7efd1ccb90f41fef33dde7462))
* use env vars for dashboard/API URLs ([#13](https://github.com/hexrift/zentla/issues/13)) ([7512e89](https://github.com/hexrift/zentla/commit/7512e89be1abf37d2bb95916c1e9033f610ef2ca))
* use env vars for docs links in admin UI ([#17](https://github.com/hexrift/zentla/issues/17)) ([1905dfe](https://github.com/hexrift/zentla/commit/1905dfeb2e90fa2b7c793048ad97c3d222e03ecf))
* use generic billing terminology in dashboard checklist ([#24](https://github.com/hexrift/zentla/issues/24)) ([f9983a1](https://github.com/hexrift/zentla/commit/f9983a1551dd4d34481a628c5076b7672f0d7cee))
* use official Stripe and Zuora logos with proper attribution ([#37](https://github.com/hexrift/zentla/issues/37)) ([a442774](https://github.com/hexrift/zentla/commit/a442774dcaaa04d3ff724300c95795c9573de4d5))
* use provider status API for Settings page Stripe badge ([5ff5aa8](https://github.com/hexrift/zentla/commit/5ff5aa8e6709dd14097f52f99ae61cf84e51550f))

## [3.0.1](https://github.com/hexrift/zentla/compare/v3.0.0...v3.0.1) (2026-01-04)


### Bug Fixes

* **api:** allow empty string for Stripe env vars ([acd8246](https://github.com/hexrift/zentla/commit/acd82465938dac1acd0083b8084b5fabc482fc6a))
* **api:** allow empty string for Stripe env vars ([bd99b47](https://github.com/hexrift/zentla/commit/bd99b471dc9d2b4524616e037c300e8f0407416f))

## [3.0.0](https://github.com/hexrift/zentla/compare/v2.4.0...v3.0.0) (2026-01-03)


### ⚠ BREAKING CHANGES

* API responses now use new status values. Existing subscriptions will be migrated via database migration.

### Features

* add checkout page to admin ui ([7a3c92b](https://github.com/hexrift/zentla/commit/7a3c92b73baec56913be88fe9189b7dcadae138b))
* Add customer portal endpoint ([48c29a6](https://github.com/hexrift/zentla/commit/48c29a64026eff433310595f2ab17a09cce9b1e6))
* add favicon and apple-touch-icon ([ee5add7](https://github.com/hexrift/zentla/commit/ee5add7a15e2a8493e45b43f509fcba90b754e2b))
* add favicon and apple-touch-icon ([9f79b24](https://github.com/hexrift/zentla/commit/9f79b24e62c074d196aa77d4a6fc23cb60d874e7))
* add feedback system and improve dashboard sync UX ([#21](https://github.com/hexrift/zentla/issues/21)) ([c02cbfb](https://github.com/hexrift/zentla/commit/c02cbfb21a5eb661a648ffc6fdc432b178f73471))
* add Google Search Console verification ([6e55ea6](https://github.com/hexrift/zentla/commit/6e55ea666b36c9aefca82dbe456081762e7b3281))
* add Google Search Console verification ([226425a](https://github.com/hexrift/zentla/commit/226425a99e9e008696aaf7c6167558938af9a53d))
* Add headless checkout, events tracking, and audit logs ([0898fcf](https://github.com/hexrift/zentla/commit/0898fcf5d6e9368b368c17f26d12aa6c79479990))
* add infra ([f34e3eb](https://github.com/hexrift/zentla/commit/f34e3eb5cacfabe19437ce4bb873e9222beabd71))
* add migration for usage models ([#73](https://github.com/hexrift/zentla/issues/73)) ([7735252](https://github.com/hexrift/zentla/commit/77352528c5a7fc4e5805a817b62b90921a0ea24c))
* Add scheduled offers, promotions, and API documentation ([7203a54](https://github.com/hexrift/zentla/commit/7203a546239f407a96e1313914c3ef128e416dae))
* add visible FAQ section to homepage ([a52d18c](https://github.com/hexrift/zentla/commit/a52d18c6502bcbd32a661e66fb6733fe26e36c01))
* add webhook prevention measures and setup dashboard ([#16](https://github.com/hexrift/zentla/issues/16)) ([65c1fec](https://github.com/hexrift/zentla/commit/65c1fecf6e74946f4d56725cece1fef73947ab69))
* add Zuora settings config and centralized versioning ([#33](https://github.com/hexrift/zentla/issues/33)) ([dc18c28](https://github.com/hexrift/zentla/commit/dc18c287178159385039a0a2ab889dced2f9a761))
* **admin-ui:** Add promotions pages and fix data display ([7c00675](https://github.com/hexrift/zentla/commit/7c00675e52f6d533cef7b90366034c56a63e7091))
* **admin-ui:** add shared button style classes ([#30](https://github.com/hexrift/zentla/issues/30)) ([c260a39](https://github.com/hexrift/zentla/commit/c260a392b8c7af7eca41565e6d297b336b200d25))
* **admin-ui:** convert feedback modal to dedicated page ([#25](https://github.com/hexrift/zentla/issues/25)) ([1ff4d44](https://github.com/hexrift/zentla/commit/1ff4d44ff51c973940e653bca94ea18556bdeec6))
* **api:** add ETag support and update URLs ([7113a62](https://github.com/hexrift/zentla/commit/7113a62cf04d8fcb72d19488112dbf8603f23895))
* **api:** add ETag support and update URLs ([a8ac088](https://github.com/hexrift/zentla/commit/a8ac088619ce68c4eca5ab122d7c4c8deed541f5))
* **api:** Add provider status endpoint and shared OpenAPI schemas ([494f58b](https://github.com/hexrift/zentla/commit/494f58b9806319c3386258c04a2d92351a03f649))
* **api:** add rate limit headers to API responses ([534eba1](https://github.com/hexrift/zentla/commit/534eba195621cc4875237b59efbfa9b4eb2e7f19))
* **api:** add rate limit headers to API responses ([a647f3f](https://github.com/hexrift/zentla/commit/a647f3fd4bd0e9424d64323c823d454c75612c32))
* **api:** complete API hardening for public beta ([433dc02](https://github.com/hexrift/zentla/commit/433dc02567b415a629450b957c631155a8d47414))
* **api:** Harden API for public beta ([de9e8f9](https://github.com/hexrift/zentla/commit/de9e8f9f92295bce4e606a9d68318e011dcbd19e))
* **audit:** add automatic audit logging with PII anonymization ([2019dbb](https://github.com/hexrift/zentla/commit/2019dbb975452f94237033e80926574339381f12))
* **ci:** add release-please for automated versioning ([d002a80](https://github.com/hexrift/zentla/commit/d002a80bae6d3a4ff230261d81e20382bd183f4a))
* complete rebrand from Relay to Zentla ([c16e1b9](https://github.com/hexrift/zentla/commit/c16e1b93a9ca12484a7b0018e27d3bfd9f749fa8))
* Complete rebrand from Relay to Zentla ([d2f5523](https://github.com/hexrift/zentla/commit/d2f55231e7795a76134f47ec97b54baad23e4cb2))
* Complete Stripe checkout flow with webhook handling ([81b1d2c](https://github.com/hexrift/zentla/commit/81b1d2c4b5af17d857352a4bc71441e4889cfe5c))
* Demo readiness - lifecycle wiring, docs, and Scalar API reference ([1f643c9](https://github.com/hexrift/zentla/commit/1f643c9afbf64ce75800d75eab67bbafad78f350))
* **deploy:** add free-tier deployment workflows ([#5](https://github.com/hexrift/zentla/issues/5)) ([54e8966](https://github.com/hexrift/zentla/commit/54e8966636635e80eefb80625986fbad8125a0bb))
* finalise for beta ([7b944f2](https://github.com/hexrift/zentla/commit/7b944f27728d6aa49ed3030b897a4ca6ff1d7693))
* GitHub issues for feedback/contact forms + Zuora logo update ([#38](https://github.com/hexrift/zentla/issues/38)) ([d127f73](https://github.com/hexrift/zentla/commit/d127f73ce4fe0cf74db3caeefbe19d04ad5ce4d6))
* implement per-workspace billing provider configuration ([#23](https://github.com/hexrift/zentla/issues/23)) ([a8f124e](https://github.com/hexrift/zentla/commit/a8f124e37937130a1ac213dd391b8c327be07c2b))
* implement strategic moat features ([#69](https://github.com/hexrift/zentla/issues/69)) ([da43243](https://github.com/hexrift/zentla/commit/da432431f54f486eeda09a218d16408939022b8e))
* production readiness improvements ([ac7a4e8](https://github.com/hexrift/zentla/commit/ac7a4e83654ca41c5dd0d86712559e8b565caa59))
* replace Stripe status terminology with Zentla-native terms ([c210095](https://github.com/hexrift/zentla/commit/c21009590fb5996bc7efc1d506e0df1b613781e5))
* replace Stripe status terminology with Zentla-native terms ([5f62a71](https://github.com/hexrift/zentla/commit/5f62a712ef1c4e06e182ee5af4bab97c8d454346))
* **seo:** add FAQ structured data for rich snippets ([72ad3b1](https://github.com/hexrift/zentla/commit/72ad3b1f1623b3244ce978cbfab8ef664a3c2213))
* **seo:** improve SEO to 9-10/10 rating ([7e08caa](https://github.com/hexrift/zentla/commit/7e08caa0c8ce48bb25e66f1b6e74f9023d982a41))
* **web:** add company contact page ([#29](https://github.com/hexrift/zentla/issues/29)) ([83a8a80](https://github.com/hexrift/zentla/commit/83a8a80f66f098a49824ae504d1d12021e8a0e51))
* **web:** add public feedback page and remove GitHub issues links ([#26](https://github.com/hexrift/zentla/issues/26)) ([9d540a6](https://github.com/hexrift/zentla/commit/9d540a66f63a75cccf0fc080000809d86307b409))
* **web:** add SEO improvements for search engine visibility ([#36](https://github.com/hexrift/zentla/issues/36)) ([b211a65](https://github.com/hexrift/zentla/commit/b211a65a697bacfeff2114e476b35695de5e246b))
* **web:** polish landing page with How it Works and Integrations sections ([8104117](https://github.com/hexrift/zentla/commit/81041179427bdbd640d3fb2ece76da7dfe0c09e7))
* **web:** polish landing page with How it Works and Integrations sections ([5fcaf73](https://github.com/hexrift/zentla/commit/5fcaf734c958d1d66ecdeec68da1e82d7e535b80))
* **zuora:** implement Zuora billing provider adapter ([7b843ac](https://github.com/hexrift/zentla/commit/7b843ac39f286c9a7f882c4304eb42edcd26d15f))
* **zuora:** implement Zuora billing provider adapter ([3a9c47f](https://github.com/hexrift/zentla/commit/3a9c47ffe96f39d3100043db15a92d1b0c8fd876))


### Bug Fixes

* add API_URL env var to Koyeb deployment ([3242421](https://github.com/hexrift/zentla/commit/3242421eb0cf84ae08043ba1b24b6c81ec397d45))
* add database migration step to deploy workflow ([5c329c3](https://github.com/hexrift/zentla/commit/5c329c36e6a9597530b581ed7b4d040118f8ec70))
* add Google verification to static HTML ([3fe06bf](https://github.com/hexrift/zentla/commit/3fe06bf84b3b09af6e56d1469ec1eaef8434357d))
* add Google verification to static HTML ([bff697e](https://github.com/hexrift/zentla/commit/bff697ebcc793184b657624e1e8cd5f984d7a645))
* add OpenSSL support for Prisma in Alpine Docker image ([#11](https://github.com/hexrift/zentla/issues/11)) ([b74cf76](https://github.com/hexrift/zentla/commit/b74cf767d9521aa6ad3468079c4d2f8dbea7148e))
* add prisma generate before build in release workflow ([e271916](https://github.com/hexrift/zentla/commit/e27191661a55047b1544018b5543ae464ca1960f))
* add robots.txt to block admin-ui from search engines ([23f24b4](https://github.com/hexrift/zentla/commit/23f24b4c7e99ad85203db73a3463ea00f1a3fea7))
* **admin-ui:** standardize colors to primary palette ([#28](https://github.com/hexrift/zentla/issues/28)) ([7075486](https://github.com/hexrift/zentla/commit/707548664b7a465e15820e5a8f4041a89cfcabbf))
* allow Scalar CDN in CSP for API docs ([#19](https://github.com/hexrift/zentla/issues/19)) ([cc9303c](https://github.com/hexrift/zentla/commit/cc9303c43621f4c04ce00f794c43552d193774a3))
* **api:** eliminate idempotency race condition ([35499d5](https://github.com/hexrift/zentla/commit/35499d5e051c239209f46532a5d19882ed1ca692))
* **api:** eliminate idempotency race condition with create-first pattern ([4be688e](https://github.com/hexrift/zentla/commit/4be688eea772108e0cb9a5c67bb91bd1e8b7e33b))
* **api:** invalidate entitlement cache on revocation ([43fef24](https://github.com/hexrift/zentla/commit/43fef2477a38616097b206382659e738c472bc98))
* **api:** invalidate entitlement cache on revocation ([d99ccc4](https://github.com/hexrift/zentla/commit/d99ccc42fbc6fdbb48e050068d4c255f52a79bea))
* **api:** make OpenAPI server URL configurable ([#27](https://github.com/hexrift/zentla/issues/27)) ([76cfc40](https://github.com/hexrift/zentla/commit/76cfc409498da087ed677aac251994d230e6ed5e))
* **api:** make STRIPE_SECRET_KEY optional in all environments ([69ec188](https://github.com/hexrift/zentla/commit/69ec18866d17b09b787ee66d143bff43ce65aff5))
* **api:** make STRIPE_SECRET_KEY optional in all environments ([15ed686](https://github.com/hexrift/zentla/commit/15ed68610825d6abf6197a67cfa2d432322738a0))
* **api:** rename checkout url field to sessionUrl for schema consistency ([8911918](https://github.com/hexrift/zentla/commit/8911918f8c45076d2a7e6f64fdd51c0ee9e44508))
* **api:** rename checkout url field to sessionUrl for schema consistency ([6519bf8](https://github.com/hexrift/zentla/commit/6519bf8bb052d2190f50eb9991f61feae1b1812e))
* **api:** return 200 for POST /quotes endpoint ([671337c](https://github.com/hexrift/zentla/commit/671337cfe4ca23fd48056edd31e0fe4dee659c2e))
* **api:** return 200 for POST /quotes endpoint ([fee329f](https://github.com/hexrift/zentla/commit/fee329f40bcf4f1a1d6bdaa7b6dd75aca889b459))
* **api:** update theme color and Zuora messaging ([b5a8fa7](https://github.com/hexrift/zentla/commit/b5a8fa7a00e242977a58f900d36edd7ffc6e6a76))
* apply Prettier formatting ([c626333](https://github.com/hexrift/zentla/commit/c626333c720b2364ad53059761f955d79c9f6854))
* **build:** update yarn workspaces foreach for Yarn 4 compatibility ([979e507](https://github.com/hexrift/zentla/commit/979e5075c90c241e6f59a008ef433c01240f088f))
* **ci:** add ESLint config for api package and fix PR validation ([2e0eb5a](https://github.com/hexrift/zentla/commit/2e0eb5a6a8694e20bfb0274137b29fe83094357b))
* **ci:** add permissions to PR automation workflow jobs ([3bb2789](https://github.com/hexrift/zentla/commit/3bb278973c7dbfafb4bdb950d711fc002a98f2de))
* **ci:** enable Corepack for Yarn 4 compatibility ([9830edf](https://github.com/hexrift/zentla/commit/9830edf888230c4aa945f17067d6cbccc1beb0d2))
* **ci:** resolve ESLint, TypeScript, and test errors ([f9daced](https://github.com/hexrift/zentla/commit/f9daced58f938b8198b18225406b1ea431db3787))
* complete rebrand cleanup (Relay → Zentla) ([a13f9a6](https://github.com/hexrift/zentla/commit/a13f9a6e911b10d371c61193c9e76944e2a8989c))
* Complete rebrand cleanup (Relay → Zentla) ([64ce2c8](https://github.com/hexrift/zentla/commit/64ce2c8cf9bf1fa9fcfa79163e8dfd45f28a32c2))
* complete Relay → Zentla rebrand across codebase ([d24431b](https://github.com/hexrift/zentla/commit/d24431bfc430839ce494b19bf1a8c11851512cc1))
* correct Koyeb app/service naming ([#20](https://github.com/hexrift/zentla/issues/20)) ([359bcdf](https://github.com/hexrift/zentla/commit/359bcdf3eccc40dbaa07584aafee9c2536e16df2))
* dashboard stripe check and remove webhook endpoint field ([#18](https://github.com/hexrift/zentla/issues/18)) ([c8213df](https://github.com/hexrift/zentla/commit/c8213df853d85c456250c2d8fbc5c99ca10e36c7))
* **db:** correct migration order for processed_provider_event ([93f60ab](https://github.com/hexrift/zentla/commit/93f60ab7bdf23d12527cdea2153ae8806e5d9cb9))
* **deploy:** correct health check path and add user tables migration ([#12](https://github.com/hexrift/zentla/issues/12)) ([9c1b6ca](https://github.com/hexrift/zentla/commit/9c1b6caa498c575cce43ef369d7e4035c4ec9b1f))
* **deploy:** correct health check path to /api/health ([#10](https://github.com/hexrift/zentla/issues/10)) ([1680a1f](https://github.com/hexrift/zentla/commit/1680a1f9012cc978d43e3406e7214c1946940348))
* **deploy:** correct Koyeb CLI flags ([#8](https://github.com/hexrift/zentla/issues/8)) ([b48a0e5](https://github.com/hexrift/zentla/commit/b48a0e53dce0720158974f66b58e1d424b6d7b2a))
* **deploy:** use curl to install Koyeb CLI and add missing env vars ([#7](https://github.com/hexrift/zentla/issues/7)) ([44a4d5e](https://github.com/hexrift/zentla/commit/44a4d5e9cae64dbdf4904cfed9b69d3df4a0156a))
* **docker:** build only API packages, exclude admin-ui ([69142cc](https://github.com/hexrift/zentla/commit/69142cc17be6154417d1045ec0fc38db6d8d9db0))
* **docker:** remove --immutable flag for yarn install ([a13e479](https://github.com/hexrift/zentla/commit/a13e479545197d6c5096b84202570dbc808238a2))
* **docker:** simplify for Yarn 4 hoisted node_modules ([b07dbe5](https://github.com/hexrift/zentla/commit/b07dbe55ad82aeb742a5e6d1444eb188a5dce9c5))
* **docker:** use Corepack instead of copying .yarn directory ([45f308d](https://github.com/hexrift/zentla/commit/45f308dd5e6b9a418df1ea7e7c5a4b8182e743e5))
* enable Corepack for Yarn 4 in deploy workflow ([150290b](https://github.com/hexrift/zentla/commit/150290b90a95192198e621409dc139b6a062efec))
* format SEO.tsx ([cd6165c](https://github.com/hexrift/zentla/commit/cd6165c286b485d5cb5cb49c9f47035591e3f0b9))
* ignore CHANGELOG.md in Prettier checks ([238f59c](https://github.com/hexrift/zentla/commit/238f59cde6e2301377e66eb6ff5c00c56dbd5d40))
* ignore CHANGELOG.md in Prettier checks ([0046516](https://github.com/hexrift/zentla/commit/00465161f013317f6945e70e815038ee442aa75d))
* improve release-please auto-merge with optional bypass ([0bd8d73](https://github.com/hexrift/zentla/commit/0bd8d73456e9561f2e3b8cbbff4923889e7b9253))
* improve SEO and UX ([39a988a](https://github.com/hexrift/zentla/commit/39a988ac00cbc88fc990d5c69d7cd660a2ee7222))
* **lint:** resolve remaining ESLint warnings ([409d95a](https://github.com/hexrift/zentla/commit/409d95af78722e856471a5b116945a0a5d8b3835))
* **lint:** resolve remaining ESLint warnings ([96e37c4](https://github.com/hexrift/zentla/commit/96e37c4567bcfc265625dd280fbcc1516f459b9a))
* **lint:** suppress ESLint warnings for necessary any types and namespace ([a2c9532](https://github.com/hexrift/zentla/commit/a2c9532f2f18a35e4941982cd6d98cab146dc595))
* remove buggy auto-merge from release-please workflow ([24f7227](https://github.com/hexrift/zentla/commit/24f7227c36bce2eaa31f5fd966d448f28387c236))
* remove non-existent contact options from versioning page ([1654eda](https://github.com/hexrift/zentla/commit/1654eda862b6acf1ed71fdcb3341e4ed306b58d8))
* remove remaining relay references from codebase ([1097104](https://github.com/hexrift/zentla/commit/1097104f0aa0873346bb24070594b2e96878f043))
* remove Stripe-specific terminology from user-facing areas ([#67](https://github.com/hexrift/zentla/issues/67)) ([3b0ed59](https://github.com/hexrift/zentla/commit/3b0ed59f38023445b921df53637ba93567743c2e))
* replace hardcoded purple/indigo colors with primary theme ([3098819](https://github.com/hexrift/zentla/commit/3098819a0df247561cec63af7cd7b96c09ab1deb))
* resolve release-please workflow JSON parsing error ([6135da1](https://github.com/hexrift/zentla/commit/6135da118736758e3814dc69810b0ccc0d5d5be2))
* resolve release-please workflow JSON parsing error ([df883cb](https://github.com/hexrift/zentla/commit/df883cbc5a160b1b03aa2f90312311bccdb4a1db))
* **security:** upgrade qs to 6.14.1 (CVE-2025-15284) ([343fb33](https://github.com/hexrift/zentla/commit/343fb33a1f40d239ae19342afeef5a05ea3a63cf))
* simplify release-please to versioning only ([c8ebe8c](https://github.com/hexrift/zentla/commit/c8ebe8cce8dba903af91f8935899f6ea873e923c))
* simplify Scalar API docs styling for better readability ([#35](https://github.com/hexrift/zentla/issues/35)) ([e4b6f33](https://github.com/hexrift/zentla/commit/e4b6f3367b1d9f927569d83d55f93abe1a8fa5a8))
* split status migration to avoid PostgreSQL enum transaction issue ([795f8c7](https://github.com/hexrift/zentla/commit/795f8c7ef8416037f651f01bcac5eed761145d79))
* standardize discountType terminology to use "percent" ([e75fa2e](https://github.com/hexrift/zentla/commit/e75fa2ef42161aaf0ac56220dd4d24f9dd9ba172))
* standardize terminology across codebase ([a6ba26e](https://github.com/hexrift/zentla/commit/a6ba26e2e8f4f8e67820f79722db95ef29d0ea9e))
* **test:** update test to use sessionUrl instead of url ([3d8047a](https://github.com/hexrift/zentla/commit/3d8047a732588fa2f5575db696d694d6e06307ab))
* update admin-ui theme to use primary (emerald) colors ([ac19ff3](https://github.com/hexrift/zentla/commit/ac19ff34c13c86205b518324674f21f6265cfa97))
* update branding consistency across packages ([9cea98f](https://github.com/hexrift/zentla/commit/9cea98f36ab722953e8e34e0b3a2d0e99993e98b))
* update branding consistency across packages ([02e6986](https://github.com/hexrift/zentla/commit/02e6986c066a8e7d8dd97ec279a103109a2593a3))
* update canonical URLs to zentla-web.pages.dev ([9a15695](https://github.com/hexrift/zentla/commit/9a15695595aee43b364d1379e99cac5f47487f2e))
* update Cloudflare Pages project names to zentla ([43653e2](https://github.com/hexrift/zentla/commit/43653e2a5b74dde90a4f2f82db591f273c4ce782))
* update Dockerfiles with [@zentla](https://github.com/zentla) package names ([2195d93](https://github.com/hexrift/zentla/commit/2195d930ba0f5ebc72d9e3b80f70e3efa4d1abbb))
* update docs and make wording more provider-agnostic ([75b8779](https://github.com/hexrift/zentla/commit/75b8779d535a704242fd82fae786551bbfa04e98))
* update Google verification tag ([6485796](https://github.com/hexrift/zentla/commit/6485796f7998fbd0f7a27d3074191dbd0328af25))
* update Google verification tag ([c5f46d0](https://github.com/hexrift/zentla/commit/c5f46d073af8f896a31bb949b2d16770a65e504a))
* update Koyeb app name to zentla ([d1fda4f](https://github.com/hexrift/zentla/commit/d1fda4fb4b9fb54943b044d3d54f5ea0b766850d))
* update provider availability and remove placeholder text ([#71](https://github.com/hexrift/zentla/issues/71)) ([e08fd4c](https://github.com/hexrift/zentla/commit/e08fd4c2e61d8dc2525abb5a3809a77ffcf7af1e))
* update session token prefix and fix prettier formatting ([fe671cd](https://github.com/hexrift/zentla/commit/fe671cd2cf2fa40fd7b7cb120e7c985aae3eae2c))
* update sitemap.xml and robots.txt URLs to zentla.dev ([2acdd54](https://github.com/hexrift/zentla/commit/2acdd54ab0acea7d976a5a7806ced22bcd9d62e7))
* use --admin flag for release PR merge ([736afe1](https://github.com/hexrift/zentla/commit/736afe1786dd0254de64e97757eb4d3b006c2cea))
* use --admin flag for release PR merge to bypass checks ([c6b199a](https://github.com/hexrift/zentla/commit/c6b199a2c718e0df3eb0700575720c55279df18d))
* use env vars for API URLs in admin-ui and web ([#14](https://github.com/hexrift/zentla/issues/14)) ([1034dec](https://github.com/hexrift/zentla/commit/1034deca10eb56b7efd1ccb90f41fef33dde7462))
* use env vars for dashboard/API URLs ([#13](https://github.com/hexrift/zentla/issues/13)) ([7512e89](https://github.com/hexrift/zentla/commit/7512e89be1abf37d2bb95916c1e9033f610ef2ca))
* use env vars for docs links in admin UI ([#17](https://github.com/hexrift/zentla/issues/17)) ([1905dfe](https://github.com/hexrift/zentla/commit/1905dfeb2e90fa2b7c793048ad97c3d222e03ecf))
* use generic billing terminology in dashboard checklist ([#24](https://github.com/hexrift/zentla/issues/24)) ([f9983a1](https://github.com/hexrift/zentla/commit/f9983a1551dd4d34481a628c5076b7672f0d7cee))
* use official Stripe and Zuora logos with proper attribution ([#37](https://github.com/hexrift/zentla/issues/37)) ([a442774](https://github.com/hexrift/zentla/commit/a442774dcaaa04d3ff724300c95795c9573de4d5))
* use provider status API for Settings page Stripe badge ([5ff5aa8](https://github.com/hexrift/zentla/commit/5ff5aa8e6709dd14097f52f99ae61cf84e51550f))

## [2.4.0](https://github.com/hexrift/zentla/compare/v2.3.0...v2.4.0) (2026-01-03)


### Features

* **api:** add ETag support and update URLs ([de1a465](https://github.com/hexrift/zentla/commit/de1a4653623bb122b1e66b3c91036a1ff72de434))
* **api:** add ETag support and update URLs ([64a49e3](https://github.com/hexrift/zentla/commit/64a49e3ef39a00fb522f2f57bc0a1ed7acbd40e4))

## [2.3.0](https://github.com/hexrift/zentla/compare/v2.2.5...v2.3.0) (2026-01-03)


### Features

* **api:** add rate limit headers to API responses ([d8da07e](https://github.com/hexrift/zentla/commit/d8da07ecdd56503f1335127074a5505942965811))

## [2.2.5](https://github.com/hexrift/zentla/compare/v2.2.4...v2.2.5) (2026-01-03)


### Bug Fixes

* **api:** invalidate entitlement cache on revocation ([f6a7d37](https://github.com/hexrift/zentla/commit/f6a7d37a58b7de211fecb0a0ef351532091ccca0))

## [2.2.4](https://github.com/hexrift/zentla/compare/v2.2.3...v2.2.4) (2026-01-03)


### Bug Fixes

* **api:** return 200 for POST /quotes endpoint ([cdd0432](https://github.com/hexrift/zentla/commit/cdd04323b7a717a49857a1b0066b72f60e09ac6a))
* **api:** return 200 for POST /quotes endpoint ([b4f19a1](https://github.com/hexrift/zentla/commit/b4f19a14c0c2cf04e2aebc1cdc6571ad7a9de0a8))

## [2.2.3](https://github.com/hexrift/zentla/compare/v2.2.2...v2.2.3) (2026-01-03)


### Bug Fixes

* **api:** eliminate idempotency race condition ([7725e9b](https://github.com/hexrift/zentla/commit/7725e9b227ef704b7e5e65d3adf2206eef433f71))
* **api:** eliminate idempotency race condition with create-first pattern ([f7b6e9e](https://github.com/hexrift/zentla/commit/f7b6e9e64b51b8dc521f19f8bb8e16bddbb52a2c))

## [2.2.2](https://github.com/hexrift/zentla/compare/v2.2.1...v2.2.2) (2026-01-03)


### Bug Fixes

* **api:** rename checkout url field to sessionUrl for schema consistency ([d0282f4](https://github.com/hexrift/zentla/commit/d0282f40d02a787410ef7b625b50b2c011bcf1cf))
* **api:** rename checkout url field to sessionUrl for schema consistency ([a02ddd8](https://github.com/hexrift/zentla/commit/a02ddd8f902af42211bf7bd81acc2e82094ba901))
* **test:** update test to use sessionUrl instead of url ([b4c8d07](https://github.com/hexrift/zentla/commit/b4c8d07f2d0a816cd0496ab1272a71ea2995877f))

## [2.2.1](https://github.com/hexrift/zentla/compare/v2.2.0...v2.2.1) (2026-01-03)


### Bug Fixes

* apply Prettier formatting ([7256a5e](https://github.com/hexrift/zentla/commit/7256a5e8171f51c628af647f97e00820b187d07f))
* update branding consistency across packages ([d67a7a3](https://github.com/hexrift/zentla/commit/d67a7a39a089223ae83ad00dc7daca1b6d6f131a))
* update branding consistency across packages ([6d47f76](https://github.com/hexrift/zentla/commit/6d47f761634e91cb10abc55db3e429bb3e972e5e))

## [2.2.0](https://github.com/hexrift/zentla/compare/v2.1.1...v2.2.0) (2026-01-03)


### Features

* add migration for usage models ([#73](https://github.com/hexrift/zentla/issues/73)) ([dee3f7e](https://github.com/hexrift/zentla/commit/dee3f7e0df352d176114e3ba343bdfdd5c89c5f8))

## [2.1.1](https://github.com/hexrift/zentla/compare/v2.1.0...v2.1.1) (2026-01-03)


### Bug Fixes

* update provider availability and remove placeholder text ([#71](https://github.com/hexrift/zentla/issues/71)) ([d3d1314](https://github.com/hexrift/zentla/commit/d3d131456a320bbad76ab6bec3cb3b0bcd6d5f5a))

## [2.1.0](https://github.com/hexrift/zentla/compare/v2.0.1...v2.1.0) (2026-01-03)


### Features

* implement strategic moat features ([#69](https://github.com/hexrift/zentla/issues/69)) ([36fe344](https://github.com/hexrift/zentla/commit/36fe344e8c527d28aa25f7e5c725766067ac0777))

## [2.0.1](https://github.com/hexrift/zentla/compare/v2.0.0...v2.0.1) (2026-01-03)


### Bug Fixes

* remove Stripe-specific terminology from user-facing areas ([#67](https://github.com/hexrift/zentla/issues/67)) ([56161a8](https://github.com/hexrift/zentla/commit/56161a86dc6333df093de707e1c105d661c76623))

## [2.0.0](https://github.com/hexrift/zentla/compare/v1.7.3...v2.0.0) (2026-01-03)


### ⚠ BREAKING CHANGES

* API responses now use new status values. Existing subscriptions will be migrated via database migration.

### Features

* replace Stripe status terminology with Zentla-native terms ([6f6cf1c](https://github.com/hexrift/zentla/commit/6f6cf1c690b02a1482d50054e569394e5777cdb6))
* replace Stripe status terminology with Zentla-native terms ([89ae468](https://github.com/hexrift/zentla/commit/89ae468ac008ca225921aac96096a9c7a7598280))


### Bug Fixes

* split status migration to avoid PostgreSQL enum transaction issue ([3ad301d](https://github.com/hexrift/zentla/commit/3ad301d68bd1e34281c7dab6255be43c53a8a175))

## [1.7.3](https://github.com/hexrift/zentla/compare/v1.7.2...v1.7.3) (2026-01-02)


### Bug Fixes

* use --admin flag for release PR merge ([b5e4f20](https://github.com/hexrift/zentla/commit/b5e4f203d3531b11567fb96a967c21dc753873d4))

## [1.7.2](https://github.com/hexrift/zentla/compare/v1.7.1...v1.7.2) (2026-01-02)


### Bug Fixes

* resolve release-please workflow JSON parsing error ([7756853](https://github.com/hexrift/zentla/commit/775685392d3de2fff763a463c38acb1001b22ddd))
* resolve release-please workflow JSON parsing error ([9dd6a09](https://github.com/hexrift/zentla/commit/9dd6a096b7c6850c83c672e0923fe130a6d40780))

## [1.7.1](https://github.com/hexrift/zentla/compare/v1.7.0...v1.7.1) (2026-01-02)


### Bug Fixes

* improve release-please auto-merge with optional bypass ([7ff169e](https://github.com/hexrift/zentla/commit/7ff169ed0aeacb119c9359e223ff2d52ab8c85bb))
* improve SEO and UX ([f0c5fe8](https://github.com/hexrift/zentla/commit/f0c5fe89652a5d0d94ecf689211e1aa61ad5dddd))
* remove buggy auto-merge from release-please workflow ([05e046a](https://github.com/hexrift/zentla/commit/05e046a971c1ba7686560c7f8aa6543e44fa3b42))
* remove non-existent contact options from versioning page ([9c724ce](https://github.com/hexrift/zentla/commit/9c724cec5ee23801a297904eb2b56ec3f688da15))
* update docs and make wording more provider-agnostic ([db0837b](https://github.com/hexrift/zentla/commit/db0837b817aed465d1d05c79640b9e5ce03c55ff))

## [1.7.0](https://github.com/hexrift/zentla/compare/v1.6.0...v1.7.0) (2026-01-02)


### Features

* add visible FAQ section to homepage ([6233e0d](https://github.com/hexrift/zentla/commit/6233e0d9c9865ea9c4313e6dad194853d7bbe033))


### Bug Fixes

* replace hardcoded purple/indigo colors with primary theme ([6fb423b](https://github.com/hexrift/zentla/commit/6fb423baf4ae364c0fcd9bf0777f7a59789fc9d5))

## [1.6.0](https://github.com/hexrift/zentla/compare/v1.5.4...v1.6.0) (2026-01-02)


### Features

* **seo:** add FAQ structured data for rich snippets ([165287f](https://github.com/hexrift/zentla/commit/165287f04eae0ee6db4355658c89e54473f2aea9))

## [1.5.4](https://github.com/hexrift/zentla/compare/v1.5.3...v1.5.4) (2026-01-02)


### Bug Fixes

* add robots.txt to block admin-ui from search engines ([fb88a73](https://github.com/hexrift/zentla/commit/fb88a73fac76ba43b179bdf80a78efd194fb4566))
* remove remaining relay references from codebase ([77a53b2](https://github.com/hexrift/zentla/commit/77a53b235f409e495330b2f91801ca61552b8ce6))
* update canonical URLs to zentla-web.pages.dev ([f899e5c](https://github.com/hexrift/zentla/commit/f899e5c6613e0a415df4783537fbf111ff1fa200))

## [1.5.3](https://github.com/hexrift/zentla/compare/v1.5.2...v1.5.3) (2026-01-02)


### Bug Fixes

* complete Relay → Zentla rebrand across codebase ([f093a02](https://github.com/hexrift/zentla/commit/f093a0245e0b9e2b134ca6a147829cacb69e7507))

## [1.5.2](https://github.com/hexrift/zentla/compare/v1.5.1...v1.5.2) (2026-01-02)


### Bug Fixes

* update admin-ui theme to use primary (emerald) colors ([8b650bd](https://github.com/hexrift/zentla/commit/8b650bdc2b0246737f9e7f0d321e4a2d6bc929b0))
* update sitemap.xml and robots.txt URLs to zentla.dev ([e2a02af](https://github.com/hexrift/zentla/commit/e2a02af59b99243294b07837d906a6fccc07f129))

## [1.5.1](https://github.com/hexrift/zentla/compare/v1.5.0...v1.5.1) (2026-01-02)


### Bug Fixes

* update Cloudflare Pages project names to zentla ([20a11e3](https://github.com/hexrift/zentla/commit/20a11e3169fbd344b169982112164a6bd7d8796b))

## [1.5.0](https://github.com/hexrift/zentla/compare/v1.4.0...v1.5.0) (2026-01-02)


### Features

* complete rebrand from Relay to Zentla ([6ae9ba0](https://github.com/hexrift/zentla/commit/6ae9ba0c2506725f225735491b002c95e2baa9b6))
* Complete rebrand from Relay to Zentla ([d939493](https://github.com/hexrift/zentla/commit/d93949332e9aa2de461464922708f901fa77d5c8))


### Bug Fixes

* update Dockerfiles with [@zentla](https://github.com/zentla) package names ([65cb06e](https://github.com/hexrift/zentla/commit/65cb06e379ecc5f7eeb9553053141f7d526e8d95))
* update Koyeb app name to zentla ([d6b691c](https://github.com/hexrift/zentla/commit/d6b691c7d99ec1a708242a416ab92be94568e240))
* update session token prefix and fix prettier formatting ([6f2952a](https://github.com/hexrift/zentla/commit/6f2952afddd54e934ebb4443e0f530c965b1c0f4))

## [1.4.0](https://github.com/hexrift/zentla/compare/v1.3.2...v1.4.0) (2026-01-02)


### Features

* add favicon and apple-touch-icon ([0802f24](https://github.com/hexrift/zentla/commit/0802f24d2d191e1f64001828afdb6f7386e05082))
* add favicon and apple-touch-icon ([4512ee8](https://github.com/hexrift/zentla/commit/4512ee8db1b4c7b91a445ae55efd553fb6228693))

## [1.3.2](https://github.com/hexrift/zentla/compare/v1.3.1...v1.3.2) (2026-01-02)


### Bug Fixes

* update Google verification tag ([b6fd112](https://github.com/hexrift/zentla/commit/b6fd1124eb989d104fe27ce0120a0e903e071844))
* update Google verification tag ([fb97b66](https://github.com/hexrift/zentla/commit/fb97b669ecd8ec80918276f3088c0ee279d5310d))

## [1.3.1](https://github.com/hexrift/zentla/compare/v1.3.0...v1.3.1) (2026-01-02)


### Bug Fixes

* add Google verification to static HTML ([dec6653](https://github.com/hexrift/zentla/commit/dec66531ba787dddef98d97389a9dffae587d09b))
* add Google verification to static HTML ([3473ba4](https://github.com/hexrift/zentla/commit/3473ba4e7cd3eb3df9e384e73b0bb152996171e1))

## [1.3.0](https://github.com/hexrift/zentla/compare/v1.2.0...v1.3.0) (2026-01-02)


### Features

* add Google Search Console verification ([5820f4b](https://github.com/hexrift/zentla/commit/5820f4b4342775fe12762d71becb28cb4086a0aa))


### Bug Fixes

* add prisma generate before build in release workflow ([58a1d30](https://github.com/hexrift/zentla/commit/58a1d3061bfbc92f7a4b130bcd24448abc51487d))
* format SEO.tsx ([2e7b599](https://github.com/hexrift/zentla/commit/2e7b599438517c5ff1326d33bf5092444c11f2e7))
* simplify release-please to versioning only ([de0d2e1](https://github.com/hexrift/zentla/commit/de0d2e1d5015376bb38ec360ac195626577cf909))

## [1.2.0](https://github.com/hexrift/zentla/compare/v1.1.0...v1.2.0) (2026-01-01)


### Features

* **seo:** improve SEO to 9-10/10 rating ([1123297](https://github.com/hexrift/zentla/commit/1123297ecaaad729b5bb99087ec4bd332159a8bc))


### Bug Fixes

* ignore CHANGELOG.md in Prettier checks ([b728cc1](https://github.com/hexrift/zentla/commit/b728cc1f56334a67f3c5f326029e4853fe56a29e))
* ignore CHANGELOG.md in Prettier checks ([7057612](https://github.com/hexrift/zentla/commit/70576129af026c91e99589d0397f61f85cf0c2b8))

## [1.1.0](https://github.com/hexrift/zentla/compare/v1.0.0...v1.1.0) (2026-01-01)


### Features

* add checkout page to admin ui ([129a6e7](https://github.com/hexrift/zentla/commit/129a6e78904bc653999a480c1dbc6acde0762c05))
* Add customer portal endpoint ([e0c48f3](https://github.com/hexrift/zentla/commit/e0c48f3d87dc17b352ceb4a0270d1c4ea81b1571))
* add feedback system and improve dashboard sync UX ([#21](https://github.com/hexrift/zentla/issues/21)) ([6cb9e56](https://github.com/hexrift/zentla/commit/6cb9e56e8d69419688af8ab28e890dd712b687ff))
* Add headless checkout, events tracking, and audit logs ([2519dd4](https://github.com/hexrift/zentla/commit/2519dd414382f21cf6126641d7a0732ed3c6ba27))
* add infra ([072d114](https://github.com/hexrift/zentla/commit/072d11454133d30459431f12ccdfafea6764b542))
* Add scheduled offers, promotions, and API documentation ([10506ce](https://github.com/hexrift/zentla/commit/10506ce285bd2d5a45f595221ff8282883c359c7))
* add webhook prevention measures and setup dashboard ([#16](https://github.com/hexrift/zentla/issues/16)) ([d5d0bc8](https://github.com/hexrift/zentla/commit/d5d0bc80482deea6f27d41934e81a3625620d8bb))
* add Zuora settings config and centralized versioning ([#33](https://github.com/hexrift/zentla/issues/33)) ([707aa76](https://github.com/hexrift/zentla/commit/707aa76bbcab6814343b2b09936365f6de54c367))
* **admin-ui:** Add promotions pages and fix data display ([02b6ece](https://github.com/hexrift/zentla/commit/02b6ecef2618477e83ec5cc7633376bdc7ef1ef1))
* **admin-ui:** add shared button style classes ([#30](https://github.com/hexrift/zentla/issues/30)) ([42a31b8](https://github.com/hexrift/zentla/commit/42a31b878217ba12091e59a528c15060ce699a04))
* **admin-ui:** convert feedback modal to dedicated page ([#25](https://github.com/hexrift/zentla/issues/25)) ([3ea312f](https://github.com/hexrift/zentla/commit/3ea312f9a4616af3e6cb0bf66f03bf37225c4583))
* **api:** Add provider status endpoint and shared OpenAPI schemas ([70eb156](https://github.com/hexrift/zentla/commit/70eb1567eb4f43e4b9bf09d05b39f4c83c6d162d))
* **api:** complete API hardening for public beta ([9e6f33d](https://github.com/hexrift/zentla/commit/9e6f33dc74247b9263bf44d695fd28168628af91))
* **api:** Harden API for public beta ([ff126a1](https://github.com/hexrift/zentla/commit/ff126a190c7439ef89cbd00ad2f1af9978a7c04b))
* **audit:** add automatic audit logging with PII anonymization ([e17ae88](https://github.com/hexrift/zentla/commit/e17ae88ab9f102ca5155826447ce1d9b7d9b6bd8))
* **ci:** add release-please for automated versioning ([cb4c7cb](https://github.com/hexrift/zentla/commit/cb4c7cbbb220b3122f75349334c27beb34da5802))
* Complete Stripe checkout flow with webhook handling ([73a7d8f](https://github.com/hexrift/zentla/commit/73a7d8ffab6f2d25a415179ec1caa78eaa678c2f))
* Demo readiness - lifecycle wiring, docs, and Scalar API reference ([77bf832](https://github.com/hexrift/zentla/commit/77bf8328bf508846ce92e3635357a3dd0644bac4))
* **deploy:** add free-tier deployment workflows ([#5](https://github.com/hexrift/zentla/issues/5)) ([40c8058](https://github.com/hexrift/zentla/commit/40c805856c95cd6ebad78e43ca3f9ec65a9a8607))
* finalise for beta ([402ccf6](https://github.com/hexrift/zentla/commit/402ccf6dd207e8dce11ed5779794aedae711d987))
* GitHub issues for feedback/contact forms + Zuora logo update ([#38](https://github.com/hexrift/zentla/issues/38)) ([d32f86b](https://github.com/hexrift/zentla/commit/d32f86b1bd033e6cf78e424aac904d38d7a0c517))
* implement per-workspace billing provider configuration ([#23](https://github.com/hexrift/zentla/issues/23)) ([afbc364](https://github.com/hexrift/zentla/commit/afbc36412dd09de0d546dee339d6a13ecaad4832))
* production readiness improvements ([64320ac](https://github.com/hexrift/zentla/commit/64320ac7f4bd5868afe9c20877f52aada54138f8))
* **web:** add company contact page ([#29](https://github.com/hexrift/zentla/issues/29)) ([4701b08](https://github.com/hexrift/zentla/commit/4701b085cc446a7e7d72f12d96135dbcec8c2c25))
* **web:** add public feedback page and remove GitHub issues links ([#26](https://github.com/hexrift/zentla/issues/26)) ([78be014](https://github.com/hexrift/zentla/commit/78be014ea4225d59ba1c034c4aa2628625048a5c))
* **web:** add SEO improvements for search engine visibility ([#36](https://github.com/hexrift/zentla/issues/36)) ([1c4be83](https://github.com/hexrift/zentla/commit/1c4be834828140c58a57c460de678162598f1ae5))
* **web:** polish landing page with How it Works and Integrations sections ([a51b9bf](https://github.com/hexrift/zentla/commit/a51b9bf62a276774caabef8acd84a3aaa6d7080c))
* **web:** polish landing page with How it Works and Integrations sections ([03939f1](https://github.com/hexrift/zentla/commit/03939f1b7eff6df870bde429c3661c7da9f0bd26))
* **zuora:** implement Zuora billing provider adapter ([60ce725](https://github.com/hexrift/zentla/commit/60ce7253d90c0b8feed371bb92027d941130cba5))
* **zuora:** implement Zuora billing provider adapter ([18d2185](https://github.com/hexrift/zentla/commit/18d218510bafef1f4d13f4886028c8e998e763fd))


### Bug Fixes

* add API_URL env var to Koyeb deployment ([07b08b3](https://github.com/hexrift/zentla/commit/07b08b33e4bce6447155b17fec2349dfce424f83))
* add database migration step to deploy workflow ([1316494](https://github.com/hexrift/zentla/commit/1316494a588cccab4684f606608938c083144210))
* add OpenSSL support for Prisma in Alpine Docker image ([#11](https://github.com/hexrift/zentla/issues/11)) ([1b1b801](https://github.com/hexrift/zentla/commit/1b1b801588801e99c10d0e47610d13caf41954e9))
* **admin-ui:** standardize colors to primary palette ([#28](https://github.com/hexrift/zentla/issues/28)) ([300d567](https://github.com/hexrift/zentla/commit/300d56739c4a0a05ed30f220e8007935777a59b6))
* allow Scalar CDN in CSP for API docs ([#19](https://github.com/hexrift/zentla/issues/19)) ([c56bc33](https://github.com/hexrift/zentla/commit/c56bc332847c572c1868dad0a67f7195d4e2ce9a))
* **api:** make OpenAPI server URL configurable ([#27](https://github.com/hexrift/zentla/issues/27)) ([fac0ad3](https://github.com/hexrift/zentla/commit/fac0ad3e300953d448f7a4228c068e08fe08678f))
* **build:** update yarn workspaces foreach for Yarn 4 compatibility ([5e67de1](https://github.com/hexrift/zentla/commit/5e67de1a712413861d87794f136fb782f42ed572))
* **ci:** add ESLint config for api package and fix PR validation ([51fe58f](https://github.com/hexrift/zentla/commit/51fe58ff5d95033f7949ae592555548fa2146501))
* **ci:** add permissions to PR automation workflow jobs ([19fc116](https://github.com/hexrift/zentla/commit/19fc116115ab3020fbd832f0ade60e805b18f1c6))
* **ci:** enable Corepack for Yarn 4 compatibility ([98c1f69](https://github.com/hexrift/zentla/commit/98c1f6962c6dbefb876e7c39f281d336c021cf9c))
* **ci:** resolve ESLint, TypeScript, and test errors ([7948932](https://github.com/hexrift/zentla/commit/7948932912e5154ca1e66ca0e276c14c56aa63f2))
* correct Koyeb app/service naming ([#20](https://github.com/hexrift/zentla/issues/20)) ([478bd32](https://github.com/hexrift/zentla/commit/478bd32dfdf69be23e65475fe75c69d4f939691e))
* dashboard stripe check and remove webhook endpoint field ([#18](https://github.com/hexrift/zentla/issues/18)) ([f784792](https://github.com/hexrift/zentla/commit/f784792fb496e4cc65a58ee70dfe106c04748e7a))
* **db:** correct migration order for processed_provider_event ([7250c87](https://github.com/hexrift/zentla/commit/7250c87078053812263c50b42288a5c780b13188))
* **deploy:** correct health check path and add user tables migration ([#12](https://github.com/hexrift/zentla/issues/12)) ([88e17ed](https://github.com/hexrift/zentla/commit/88e17edff1e2f3d7d527340c9dd037ee6e8246dc))
* **deploy:** correct health check path to /api/health ([#10](https://github.com/hexrift/zentla/issues/10)) ([94bb250](https://github.com/hexrift/zentla/commit/94bb2501b15911ce4745eb43458fc0156b15c859))
* **deploy:** correct Koyeb CLI flags ([#8](https://github.com/hexrift/zentla/issues/8)) ([9c96047](https://github.com/hexrift/zentla/commit/9c960474d074b20da7937689d09a03a875ace995))
* **deploy:** use curl to install Koyeb CLI and add missing env vars ([#7](https://github.com/hexrift/zentla/issues/7)) ([f46af1f](https://github.com/hexrift/zentla/commit/f46af1f4578b9e12bcbb5c9606d9986e85ee09f7))
* **docker:** build only API packages, exclude admin-ui ([6cf421c](https://github.com/hexrift/zentla/commit/6cf421c12736b321f9c5e02369bc6d222e213dad))
* **docker:** remove --immutable flag for yarn install ([3c0e061](https://github.com/hexrift/zentla/commit/3c0e06188b5fc473c66cae6864de495bac479236))
* **docker:** simplify for Yarn 4 hoisted node_modules ([0df04b6](https://github.com/hexrift/zentla/commit/0df04b6327c254173d1266e50bb1daa6f1b060d9))
* **docker:** use Corepack instead of copying .yarn directory ([3b283e1](https://github.com/hexrift/zentla/commit/3b283e13c3ecc48c2f5367135b1724083a900492))
* enable Corepack for Yarn 4 in deploy workflow ([f57b6df](https://github.com/hexrift/zentla/commit/f57b6dfcd15696a0e0e818fcfa7b86f643e49d2d))
* **lint:** resolve remaining ESLint warnings ([93ba700](https://github.com/hexrift/zentla/commit/93ba70054f5cab2ff2b91ed4c3a6607a78bb247b))
* **lint:** resolve remaining ESLint warnings ([c6e03c8](https://github.com/hexrift/zentla/commit/c6e03c80eaa02ceffae195bc92d3b388edf58cde))
* **lint:** suppress ESLint warnings for necessary any types and namespace ([6fe4823](https://github.com/hexrift/zentla/commit/6fe4823c99f24aa07622e50e138e4e457efe3a6f))
* **security:** upgrade qs to 6.14.1 (CVE-2025-15284) ([5143e75](https://github.com/hexrift/zentla/commit/5143e7526f55ab5d9fabdf072c9d52ecbf8b7aa8))
* simplify Scalar API docs styling for better readability ([#35](https://github.com/hexrift/zentla/issues/35)) ([26eb95e](https://github.com/hexrift/zentla/commit/26eb95e5d28e1f3aa95f6c5466b77b5de3564b4f))
* standardize discountType terminology to use "percent" ([b0f940f](https://github.com/hexrift/zentla/commit/b0f940f4f5970f94eed441a72cdb7b7eca713610))
* standardize terminology across codebase ([504657a](https://github.com/hexrift/zentla/commit/504657a50c58e3ed4e277e6baeb0cffec3d95c40))
* use env vars for API URLs in admin-ui and web ([#14](https://github.com/hexrift/zentla/issues/14)) ([28d61ac](https://github.com/hexrift/zentla/commit/28d61acf2dec8d712caf3c82b3e7dbcfe6a3b640))
* use env vars for dashboard/API URLs ([#13](https://github.com/hexrift/zentla/issues/13)) ([3064d31](https://github.com/hexrift/zentla/commit/3064d31da56fc7c7cfef38b9ca40ab677034d3d9))
* use env vars for docs links in admin UI ([#17](https://github.com/hexrift/zentla/issues/17)) ([f9b93a5](https://github.com/hexrift/zentla/commit/f9b93a5e7d66df9560dde8c666170811c012d015))
* use generic billing terminology in dashboard checklist ([#24](https://github.com/hexrift/zentla/issues/24)) ([84c8baf](https://github.com/hexrift/zentla/commit/84c8bafe62d689ee780522cff0cd243a187157bb))
* use official Stripe and Zuora logos with proper attribution ([#37](https://github.com/hexrift/zentla/issues/37)) ([79680ac](https://github.com/hexrift/zentla/commit/79680ac6f76d82e43c5c15300c9f53e2991cb267))
* use provider status API for Settings page Stripe badge ([aa457c0](https://github.com/hexrift/zentla/commit/aa457c02bf4c5ee54de8844aa04c5ed0acb7b73c))
