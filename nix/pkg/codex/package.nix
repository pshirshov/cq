# codex: pin to the latest GitHub-released static binary. Using the release
# artefact (vs nixpkgs' rust build) skips a multi-minute Cargo vendor build and
# tracks alpha tags closely. Bump `version` + the four `hash` entries below.
#
# Vendored into the cq flake alongside the rest of the LLM harness so consumers
# don't need an overlay to pin codex. `codex` (the nixpkgs base) is used only
# for meta/passthru and as the fallback on unsupported systems.
{ lib
, stdenv
, stdenvNoCC
, fetchurl
, installShellFiles
, makeBinaryWrapper
, ripgrep
, bubblewrap
, versionCheckHook
, codex
}:

let
  version = "0.135.0";
  binaryAssets = {
    aarch64-darwin = {
      asset = "codex-aarch64-apple-darwin.tar.gz";
      hash = "sha256-v+5SmujraFIUyKq2YdjWtDmzI2XSy/nVBSHNaZbUszw=";
    };
    aarch64-linux = {
      asset = "codex-aarch64-unknown-linux-musl.tar.gz";
      hash = "sha256-VovOHVk+8l/99VSTaahgYIVlIpRkalxJYVR6iU6i920=";
    };
    x86_64-darwin = {
      asset = "codex-x86_64-apple-darwin.tar.gz";
      hash = "sha256-fiavDEUU7mXG+DdJhLQrb+P3z2lzK2IwX4Xywny9xuU=";
    };
    x86_64-linux = {
      asset = "codex-x86_64-unknown-linux-musl.tar.gz";
      hash = "sha256-oV59rWV9pKDhIO7eKVVv7m1Q6MkZdZzC7Lo8mQmTY+I=";
    };
  };
  system = stdenv.hostPlatform.system;
in
if lib.hasAttr system binaryAssets then
  let
    binaryAsset = binaryAssets.${system};
  in
  stdenvNoCC.mkDerivation {
    pname = "codex";
    inherit version;

    src = fetchurl {
      url = "https://github.com/openai/codex/releases/download/rust-v${version}/${binaryAsset.asset}";
      hash = binaryAsset.hash;
    };

    nativeBuildInputs = [
      installShellFiles
      makeBinaryWrapper
    ];

    dontUnpack = true;
    dontConfigure = true;
    dontBuild = true;

    installPhase = ''
      runHook preInstall
      tar -xzf "$src"
      install -Dm755 codex-* "$out/bin/codex"
      runHook postInstall
    '';

    postInstall = lib.optionalString (stdenv.buildPlatform.canExecute stdenv.hostPlatform) ''
      installShellCompletion --cmd codex \
        --bash <($out/bin/codex completion bash) \
        --fish <($out/bin/codex completion fish) \
        --zsh <($out/bin/codex completion zsh)
    '';

    postFixup = ''
      wrapProgram "$out/bin/codex" --prefix PATH : ${
        lib.makeBinPath ([ ripgrep ] ++ lib.optionals stdenv.hostPlatform.isLinux [ bubblewrap ])
      }
    '';

    doInstallCheck = stdenv.buildPlatform.canExecute stdenv.hostPlatform;
    nativeInstallCheckInputs = [ versionCheckHook ];

    meta = codex.meta // {
      mainProgram = "codex";
    };

    passthru = codex.passthru or { };
  }
else
  codex
