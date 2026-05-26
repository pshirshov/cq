/** Type shim for CSS Modules (*.module.css). Bun bundler handles the import natively; tsc needs this declaration to accept the import without error. */
declare module "*.module.css" {
  const classes: Readonly<Record<string, string>>;
  export default classes;
}
