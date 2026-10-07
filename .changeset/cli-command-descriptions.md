---
"product-map": patch
---

Command capabilities now carry descriptions. The CLI adapter reads static command declarations — commander, yargs, and cac chains, citty `defineCommand`, and declarative command-spec objects — and takes each command's `purpose` from its own declaration; dotted i18n keys are ignored. A command directory holding only a declaration module is recognized. Command ids are unchanged.
