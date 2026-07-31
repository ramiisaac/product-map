/**
 * A failure a user caused and can fix. The CLI maps it to `pmap: <message>`
 * and exit 1; anything else is a bug and keeps its stack trace.
 */
export class CliError extends Error {}
