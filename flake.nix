{
  description = "cq — Web UI for the Claude Agent SDK (Bun + React + WebSocket)";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = import nixpkgs { inherit system; };
      in {
        devShells.default = pkgs.mkShell {
          name = "cq-dev";

          packages = with pkgs; [
            bun
            nodejs_22
            sqlite
            sqlite-interactive
            git
            jq
            ripgrep
            fd
            gh
          ];

          shellHook = ''
            echo "cq dev shell"
            echo "  bun:    $(bun --version)"
            echo "  node:   $(node --version)"
            echo "  sqlite: $(sqlite3 --version | awk '{print $1}')"
            export BUN_INSTALL_CACHE_DIR="$PWD/.cache/bun"
            mkdir -p "$BUN_INSTALL_CACHE_DIR"
          '';
        };
      });
}
