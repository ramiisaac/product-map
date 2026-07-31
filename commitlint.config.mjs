export default {
  extends: ["@commitlint/config-conventional"],
  rules: {
    // House style is that prose is never hard-wrapped, so a body paragraph is
    // one physical line and soft-wraps in whatever is reading it. The default
    // 100-character ceiling would force the opposite.
    "body-max-line-length": [0, "always"],
    "footer-max-line-length": [0, "always"],
  },
};
