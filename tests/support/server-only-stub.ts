/**
 * Stands in for the `server-only` package under test.
 *
 * That package exists to make a build fail if a server module is pulled into a
 * client bundle. It has no runtime behaviour worth exercising, and importing the
 * real one outside a React Server Component throws, so the tests alias it here.
 */
export {};
