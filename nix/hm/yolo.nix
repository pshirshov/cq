# Portable home-manager module for the `yolo` bubblewrap sandbox wrapper.
#
# Split out of dev-llm.nix (which had grown to own the whole Claude/Codex/Pi
# harness AND the sandbox) so the sandbox's options + package wiring live in one
# focused module. Imported alongside dev-llm via `homeManagerModules.dev-llm`,
# so it shares the same `config`: it reuses `smind.hm.dev.llm.enable` as its
# on/off switch. Provider/API-key secrets are wired here via
# `smind.hm.dev.llm.yolo.secretSessionVariables` (composed + sourced inside the
# sandbox), so every harness in the sandbox inherits them.
#
# Curried over the flake's `inputs` (for the codegraph package the per-project
# index bootstrap needs). All host/hardware coupling (device passthrough,
# rootless-Podman socket, ollama models dir, ssh key, prompt extensions) is
# surfaced as `smind.hm.dev.llm.*` options the consumer wires from its own
# NixOS config — GPU passthrough is no longer built in.
{ inputs }:
{ config
, lib
, pkgs
, ...
}:
let
  system = pkgs.stdenv.hostPlatform.system;
  isLinux = pkgs.stdenv.hostPlatform.isLinux;
  codegraphPkg = inputs.codegraph.packages.${system}.default;

  cfg = config.smind.hm.dev.llm;

  # SSH key for remote worker machines: bound read-only (folded into the ro path
  # set below) and announced to agents via a prompt fragment (config, below) —
  # replacing the old dedicated YOLO_LLM_SSH_KEY_PATH env + bind. null disables.
  sshKeySet = cfg.llmSshKeyPath != null;

  # Prompt-extension manifest (Idea 1): each Nix-`when`-enabled fragment becomes
  # a store file (multi-line-safe) plus a `target<TAB>tags-csv<TAB>file` line, in
  # order. yolo.sh composes the per-agent prompt at launch and drops fragments
  # whose tags intersect the runtime `--disable` set — so the same tag gates a
  # device bind AND its note (e.g. `--disable=gpu`).
  promptManifest = lib.imap0
    (
      i: e:
      "${e.target}\t${lib.concatStringsSep "," e.tags}\t${pkgs.writeText "yolo-prompt-${toString i}" e.prompt}"
    )
    (lib.filter (e: e.when) cfg.yolo.promptExtensions);

  yoloPkg = pkgs.callPackage ../pkg/yolo/default.nix {
    codegraph = codegraphPkg;
    podmanSocketPath = cfg.podman.socketPath;
    podmanSocketUri = cfg.podman.socketUri;
    # The remote-worker SSH key is just another read-only bind.
    extraReadOnlyPaths = cfg.yolo.extraReadOnlyPaths ++ lib.optional sshKeySet cfg.llmSshKeyPath;
    extraReadWritePaths = cfg.yolo.extraReadWritePaths;
    # Device paths bound with device access (bwrap --dev-bind), e.g. GPU nodes.
    extraDevicePaths = cfg.yolo.extraDevicePaths;
    # Bind the host's ollama models dir (the consumer sets this from its own
    # services.ollama.models); null skips the bind.
    ollamaModelsDir = cfg.ollamaModelsDir;
    # Extra packages exposed ONLY inside the sandbox (not the host profile).
    sandboxPackages = cfg.yolo.packages;
    # Declarative env vars set inside the sandbox session.
    sessionVariables = cfg.yolo.sessionVariables;
    # Secret-file-backed env vars composed + sourced inside the sandbox.
    secretSessionVariables = cfg.yolo.secretSessionVariables;
    # Tagged, runtime-suppressible system-prompt additions (see promptExtensions).
    inherit promptManifest;
  };
in
{
  options = {
    # Host/hardware coupling surfaced as plain options; the consumer wires
    # them from its own NixOS config (device passthrough, rootless-Podman
    # socket, ollama models dir). All default to off/null so a bare consumer works.
    smind.hm.dev.llm.podman.socketPath = lib.mkOption {
      type = lib.types.nullOr lib.types.str;
      default = null;
      description = ''
        Host path of a rootless-Podman socket to bind into the yolo sandbox,
        exposing container access to sandboxed agents. null disables it.
      '';
    };

    smind.hm.dev.llm.podman.socketUri = lib.mkOption {
      type = lib.types.nullOr lib.types.str;
      default = null;
      description = ''
        DOCKER_HOST-style URI for the rootless-Podman socket bound via
        {option}`smind.hm.dev.llm.podman.socketPath`. null disables it.
      '';
    };

    smind.hm.dev.llm.ollamaModelsDir = lib.mkOption {
      type = lib.types.nullOr lib.types.str;
      default = null;
      description = ''
        Host directory holding the ollama models, ro-bound into the yolo
        sandbox so local-model agents can read them. null skips the bind.
      '';
    };

    smind.hm.dev.llm.llmSshKeyPath = lib.mkOption {
      type = lib.types.nullOr lib.types.str;
      default = null;
      description = ''
        Path to an SSH private key for remote worker machines. When set, the key
        is read-only bound into the sandbox at the same path it lives at on the
        host (folded into the read-only bind set), AND a prompt fragment
        (tagged "ssh") is added telling agents to authenticate with it when
        instructed to use remote workers (e.g. `ssh -i <path>` /
        `GIT_SSH_COMMAND='ssh -i <path>'`). null disables both.
      '';
    };

    smind.hm.dev.llm.yolo.extraReadOnlyPaths = lib.mkOption {
      type = lib.types.listOf lib.types.str;
      default = [ ];
      description = ''
        Extra host paths to ro-bind into the yolo sandbox. Paths that don't
        exist on the host are silently skipped (handled by llm-sandbox.sh).
        Use this for per-host bulk storage (e.g. `/srv/nvme`) that should
        be visible read-only to sandboxed agents.
      '';
    };

    smind.hm.dev.llm.yolo.extraReadWritePaths = lib.mkOption {
      type = lib.types.listOf lib.types.str;
      default = [ ];
      description = ''
        Extra host paths to rw-bind into the yolo sandbox. Same skip-on-missing
        semantics as `extraReadOnlyPaths`.
      '';
    };

    smind.hm.dev.llm.yolo.extraDevicePaths = lib.mkOption {
      type = lib.types.listOf (lib.types.submodule {
        options = {
          path = lib.mkOption {
            type = lib.types.str;
            description = "Host device path to bind (file or directory).";
          };
          tags = lib.mkOption {
            type = lib.types.listOf lib.types.str;
            default = [ ];
            example = [ "gpu" "amd" ];
            description = ''
              Suppression tags (e.g. `[ "gpu" "amd" ]`). The runtime
              `yolo --disable=<tag>` flag drops every device (and prompt
              fragment) carrying that tag, so tag a device with both its broad
              feature ("gpu") and any finer label ("amd") you may want to target.
            '';
          };
        };
      });
      default = [ ];
      example = lib.literalExpression ''
        [
          { path = "/dev/dri"; tags = [ "gpu" ]; }
          { path = "/dev/kfd"; tags = [ "gpu" "amd" ]; }
        ]
      '';
      description = ''
        Host device paths bound into the sandbox WITH device access (bwrap
        `--dev-bind`) — e.g. GPU render nodes for compute passthrough. Each entry
        is `{ path; tags ? []; }`; a directory `path` exposes every device node
        under it (so `/dev/dri` covers all render nodes). A device is dropped at
        launch if any of its `tags` is in the `yolo --disable=<tag>` set (e.g.
        `--disable=gpu`). Missing paths are skipped. GPU passthrough is no longer
        built in: wire the device paths here, the non-device GPU bits
        (`/run/opengl-driver`, `/sys`) via
        {option}`smind.hm.dev.llm.yolo.extraReadOnlyPaths`, and the GPU
        availability note (tagged the same, so `--disable=gpu` hides it too) via
        {option}`smind.hm.dev.llm.yolo.promptExtensions`.
      '';
    };

    smind.hm.dev.llm.yolo.promptExtensions = lib.mkOption {
      type = lib.types.listOf (lib.types.submodule {
        options = {
          prompt = lib.mkOption {
            type = lib.types.lines;
            description = "System-prompt fragment text appended to the targeted agent(s).";
          };
          target = lib.mkOption {
            type = lib.types.enum [ "claude" "pi" "*" ];
            default = "*";
            description = ''
              Which agent(s) the fragment is appended to: "claude", "pi", or
              "*" (both). Codex has no `--append-system-prompt` CLI hook, so it
              is not a valid target — deliver Codex instructions through the
              shared memory (`programs.codex` context / AGENTS.md) instead.
            '';
          };
          tags = lib.mkOption {
            type = lib.types.listOf lib.types.str;
            default = [ ];
            example = [ "gpu" ];
            description = ''
              Suppression tags. The fragment is dropped at launch if any tag is
              in the `yolo --disable=<tag>` set — the same namespace as
              {option}`smind.hm.dev.llm.yolo.extraDevicePaths` tags, so tagging
              the GPU note `[ "gpu" ]` makes `--disable=gpu` hide the note along
              with the GPU device binds.
            '';
          };
          when = lib.mkOption {
            type = lib.types.bool;
            default = true;
            description = ''
              Static (Nix-eval-time) gate: include this fragment only when true.
              Use it for per-host inclusion; use `tags` + `--disable` for
              per-run runtime suppression.
            '';
          };
        };
      });
      default = [ ];
      example = lib.literalExpression ''
        [
          { prompt = "GPU access is enabled (NVIDIA). /dev/dri is bound."; when = config.hardware.nvidia.modesetting.enable; }
          { prompt = "This host is the NAS; /srv holds the media library."; target = "*"; }
        ]
      '';
      description = ''
        Ordered system-prompt additions, appended (blank-line-separated) to each
        agent's `--append-system-prompt`, filtered per agent by `target`, gated
        statically by `when` (Nix-eval) and at runtime by `tags` + the
        `yolo --disable=<tag>` flag. List-merges across modules: this module
        contributes the YOLO pre-authorization note (target "claude"), and —
        when configured — the remote-worker SSH note (tag "ssh", see
        {option}`smind.hm.dev.llm.llmSshKeyPath`) and the GitHub agent-account
        note (tag "github", when `GH_TOKEN` is in
        {option}`smind.hm.dev.llm.yolo.secretSessionVariables`), all via
        `mkBefore`; the consumer appends host-specific fragments (e.g. the GPU
        availability note, tagged "gpu"). Replaces the old hardcoded
        permission/GPU notes and the former `extraPromptFragments` option. Codex
        receives none (no CLI hook).
      '';
    };

    smind.hm.dev.llm.yolo.packages = lib.mkOption {
      type = lib.types.listOf lib.types.package;
      default = [ ];
      example = lib.literalExpression "[ pkgs.ripgrep pkgs.jq pkgs.shellcheck ]";
      description = ''
        Extra packages to expose on `PATH` INSIDE the yolo sandbox without
        installing them into the host home profile. The packages are collected
        into a single `buildEnv` whose `bin` directory is prepended to the
        sandboxed command's `PATH` (the closure is already reachable via the
        ro-bound `/nix/store`, so no extra bind is needed). Applies to every
        `yolo` subcommand (claude/codex/pi/shell/cmd). Linux-only, like the rest
        of the sandbox.
      '';
    };

    smind.hm.dev.llm.yolo.sessionVariables = lib.mkOption {
      type = lib.types.attrsOf lib.types.str;
      default = { };
      example = lib.literalExpression ''
        {
          EDITOR = "nvim";
          RUST_BACKTRACE = "1";
        }
      '';
      description = ''
        Environment variables to set INSIDE the yolo sandbox session, as a
        NAME -> value map. Applied to every `yolo` subcommand
        (claude/codex/pi/shell/cmd) via the sandbox's `--env`, and overridable
        per-invocation by an explicit `--env NAME=VALUE` flag. Values may contain
        `=` but not newlines. Mirrors home-manager's `home.sessionVariables`, but
        scoped to the sandbox only — these are NOT exported into the host session.
      '';
    };

    smind.hm.dev.llm.yolo.secretSessionVariables = lib.mkOption {
      type = lib.types.attrsOf lib.types.str;
      default = { };
      example = lib.literalExpression ''
        {
          OPENROUTER_API_KEY   = "/run/agenix/openrouter";
          BRAVE_SEARCH_API_KEY = config.age.secrets.brave.path;
          ANTHROPIC_API_KEY    = config.age.secrets.anthropic.path;
        }
      '';
      description = ''
        Secret-file-backed environment variables for the sandbox, as a map from
        the environment-variable name to the host path of the secret FILE (e.g.
        an agenix secret under `/run/agenix`, or `config.age.secrets.<n>.path`).

        Unlike {option}`smind.hm.dev.llm.yolo.sessionVariables` (literal values),
        these never pass through bwrap's argv. At launch, yolo reads each readable
        secret file's content on the host, composes a single mode-0600 file of
        `NAME=VALUE` lines, binds ONLY that one file into the sandbox, and
        re-exports each line verbatim inside before exec — so every harness
        (claude/codex/pi/shell/cmd) inherits the vars, and tokens stay out of argv
        and the Nix store. The composed file lives in tmpfs and is removed on
        exit. A secret whose file is unreadable on this host is skipped with a
        warning, so hosts missing a secret degrade gracefully. Values are
        single-line (API tokens); use {option}`smind.hm.dev.llm.llmSshKeyPath`
        for multi-line key files.
      '';
    };
  };

  config = lib.mkMerge [
    {
      # Module-provided prompt fragments, leading the list (mkBefore); the
      # consumer's fragments append after.
      #   - YOLO authorization (claude only — Pi/Codex have no permission system).
      #   - SSH remote-worker key usage (only when llmSshKeyPath is set).
      #   - GitHub agent-account note (only when GH_TOKEN is a secret session var).
      smind.hm.dev.llm.yolo.promptExtensions = lib.mkBefore (
        [
          {
            target = "claude";
            prompt = ''YOLO mode is active. The user has pre-authorized destructive shell operations (rm, rm -rf, kill, git reset --hard, etc.) and will not be available to confirm. Proceed without asking for confirmation on such operations. Standard safety still applies to actions with broader blast radius (force-push to shared branches, deleting remote resources, sending external messages).'';
          }
        ]
        ++ lib.optional sshKeySet {
          target = "*";
          tags = [ "ssh" ];
          prompt = ''A dedicated SSH private key for logging into remote worker machines is bound read-only at ${cfg.llmSshKeyPath} inside the sandbox. When you are instructed to use remote worker machines, authenticate with this key — e.g. `ssh -i ${cfg.llmSshKeyPath} <user>@<host>` or `GIT_SSH_COMMAND='ssh -i ${cfg.llmSshKeyPath}' git <push|fetch> ...`.'';
        }
        ++ lib.optional (cfg.yolo.secretSessionVariables ? GH_TOKEN) {
          target = "*";
          tags = [ "github" ];
          prompt = ''A GitHub token is available in the GH_TOKEN environment variable. It belongs to a GitHub account created specifically for autonomous agentic work — it is NOT the user's personal account. Use it (via the `gh` CLI, which reads GH_TOKEN, or the token directly) for GitHub operations carried out on the agent's own behalf.'';
        }
      );
    }
    # The sandbox is Linux-only (bubblewrap); on Darwin claude-code uses its own
    # sandbox wrapper, wired in dev-llm.nix. Gated on the shared harness enable.
    (lib.mkIf (cfg.enable && isLinux) {
      home.packages = [
        pkgs.bubblewrap
        yoloPkg
      ];
    })
  ];
}
