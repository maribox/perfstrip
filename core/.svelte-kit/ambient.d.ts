
// this file is generated — do not edit it


/// <reference types="@sveltejs/kit" />

/**
 * Environment variables [loaded by Vite](https://vitejs.dev/guide/env-and-mode.html#env-files) from `.env` files and `process.env`. Like [`$env/dynamic/private`](https://svelte.dev/docs/kit/$env-dynamic-private), this module cannot be imported into client-side code. This module only includes variables that _do not_ begin with [`config.kit.env.publicPrefix`](https://svelte.dev/docs/kit/configuration#env) _and do_ start with [`config.kit.env.privatePrefix`](https://svelte.dev/docs/kit/configuration#env) (if configured).
 * 
 * _Unlike_ [`$env/dynamic/private`](https://svelte.dev/docs/kit/$env-dynamic-private), the values exported from this module are statically injected into your bundle at build time, enabling optimisations like dead code elimination.
 * 
 * ```ts
 * import { API_KEY } from '$env/static/private';
 * ```
 * 
 * Note that all environment variables referenced in your code should be declared (for example in an `.env` file), even if they don't have a value until the app is deployed:
 * 
 * ```
 * MY_FEATURE_FLAG=""
 * ```
 * 
 * You can override `.env` values from the command line like so:
 * 
 * ```bash
 * MY_FEATURE_FLAG="enabled" npm run dev
 * ```
 */
declare module '$env/static/private' {
	export const IMSETTINGS_INTEGRATE_DESKTOP: string;
	export const SHELL: string;
	export const LSCOLORS: string;
	export const npm_command: string;
	export const SESSION_MANAGER: string;
	export const USER_ZDOTDIR: string;
	export const COLORTERM: string;
	export const XDG_CONFIG_DIRS: string;
	export const LESS: string;
	export const XDG_SESSION_PATH: string;
	export const HISTCONTROL: string;
	export const XDG_MENU_PREFIX: string;
	export const TERM_PROGRAM_VERSION: string;
	export const CONDA_EXE: string;
	export const HOSTNAME: string;
	export const HISTSIZE: string;
	export const ICEAUTHORITY: string;
	export const LANGUAGE: string;
	export const _P9K_TTY: string;
	export const NODE: string;
	export const JAVA_HOME: string;
	export const DOTNET_ROOT: string;
	export const QT_LOGGING_RULES: string;
	export const SSH_AUTH_SOCK: string;
	export const npm_config_verify_deps_before_run: string;
	export const GRADLE_HOME: string;
	export const P9K_TTY: string;
	export const MEMORY_PRESSURE_WRITE: string;
	export const SDKMAN_CANDIDATES_DIR: string;
	export const HOMEBREW_PREFIX: string;
	export const XMODIFIERS: string;
	export const DESKTOP_SESSION: string;
	export const GTK_RC_FILES: string;
	export const NO_AT_BRIDGE: string;
	export const GDK_CORE_DEVICE_EVENTS: string;
	export const __zsh_config_dir: string;
	export const GPG_TTY: string;
	export const XML_CATALOG_FILES: string;
	export const EDITOR: string;
	export const XDG_SEAT: string;
	export const PWD: string;
	export const XDG_SESSION_DESKTOP: string;
	export const LOGNAME: string;
	export const XDG_SESSION_TYPE: string;
	export const CONDA_PREFIX: string;
	export const MODULESHOME: string;
	export const MAMBA_ROOT_PREFIX: string;
	export const MANPATH: string;
	export const PNPM_HOME: string;
	export const __GL_SHOW_GRAPHICS_OSD: string;
	export const SYSTEMD_EXEC_PID: string;
	export const XAUTHORITY: string;
	export const SDL_VIDEO_MINIMIZE_ON_FOCUS_LOSS: string;
	export const VSCODE_GIT_ASKPASS_NODE: string;
	export const VSCODE_INJECTION: string;
	export const XKB_DEFAULT_MODEL: string;
	export const GTK2_RC_FILES: string;
	export const __MODULES_SHARE_MANPATH: string;
	export const HOME: string;
	export const SSH_ASKPASS: string;
	export const LANG: string;
	export const LS_COLORS: string;
	export const XDG_CURRENT_DESKTOP: string;
	export const npm_package_version: string;
	export const __zsh_user_data_dir: string;
	export const MEMORY_PRESSURE_WATCH: string;
	export const WAYLAND_DISPLAY: string;
	export const CONDA_PROMPT_MODIFIER: string;
	export const GIT_ASKPASS: string;
	export const XDG_SEAT_PATH: string;
	export const INVOCATION_ID: string;
	export const MANAGERPID: string;
	export const IMSETTINGS_MODULE: string;
	export const INIT_CWD: string;
	export const DOTNET_BUNDLE_EXTRACT_BASE_DIR: string;
	export const CHROME_DESKTOP: string;
	export const STEAM_FRAME_FORCE_CLOSE: string;
	export const KDE_SESSION_UID: string;
	export const INFOPATH: string;
	export const npm_lifecycle_script: string;
	export const MOZ_GMP_PATH: string;
	export const VSCODE_GIT_ASKPASS_EXTRA_ARGS: string;
	export const XKB_DEFAULT_LAYOUT: string;
	export const XDG_SESSION_CLASS: string;
	export const MAMBA_EXE: string;
	export const TERM: string;
	export const npm_package_name: string;
	export const ZSH: string;
	export const VSCODE_NONCE: string;
	export const ZDOTDIR: string;
	export const LESSOPEN: string;
	export const USER: string;
	export const npm_config_frozen_lockfile: string;
	export const KOTLIN_HOME: string;
	export const VSCODE_GIT_IPC_HANDLE: string;
	export const HOMEBREW_CELLAR: string;
	export const CONDA_SHLVL: string;
	export const MODULES_RUN_QUARANTINE: string;
	export const QT_WAYLAND_RECONNECT: string;
	export const KDE_SESSION_VERSION: string;
	export const PAM_KWALLET5_LOGIN: string;
	export const MAVEN_HOME: string;
	export const LOADEDMODULES: string;
	export const SDKMAN_DIR: string;
	export const DISPLAY: string;
	export const npm_lifecycle_event: string;
	export const SHLVL: string;
	export const MOZ_ENABLE_WAYLAND: string;
	export const PAGER: string;
	export const HOMEBREW_REPOSITORY: string;
	export const _P9K_SSH_TTY: string;
	export const XDG_VTNR: string;
	export const SDKMAN_CANDIDATES_API: string;
	export const XDG_SESSION_ID: string;
	export const npm_config_user_agent: string;
	export const PNPM_SCRIPT_SRC_DIR: string;
	export const npm_execpath: string;
	export const CONDA_PYTHON_EXE: string;
	export const LD_LIBRARY_PATH: string;
	export const NIX_REMOTE: string;
	export const XDG_RUNTIME_DIR: string;
	export const NODE_PATH: string;
	export const CONDA_DEFAULT_ENV: string;
	export const __MODULES_LMINIT: string;
	export const TOMCAT_HOME: string;
	export const DEBUGINFOD_URLS: string;
	export const LC_TIME: string;
	export const BUN_INSTALL: string;
	export const DEBUGINFOD_IMA_CERT_PATH: string;
	export const P9K_SSH: string;
	export const LC_ALL: string;
	export const KDEDIRS: string;
	export const MAVEN_OPTS: string;
	export const XKB_DEFAULT_VARIANT: string;
	export const VSCODE_GIT_ASKPASS_MAIN: string;
	export const QT_AUTO_SCREEN_SCALE_FACTOR: string;
	export const JOURNAL_STREAM: string;
	export const XDG_DATA_DIRS: string;
	export const GDK_BACKEND: string;
	export const KDE_FULL_SESSION: string;
	export const PATH: string;
	export const __GLX_VENDOR_LIBRARY_NAME: string;
	export const npm_config_node_gyp: string;
	export const MODULEPATH: string;
	export const ORIGINAL_XDG_CURRENT_DESKTOP: string;
	export const DBUS_SESSION_BUS_ADDRESS: string;
	export const SDKMAN_PLATFORM: string;
	export const KDE_APPLICATIONS_AS_SCOPE: string;
	export const __zsh_cache_dir: string;
	export const __VK_LAYER_NV_optimus: string;
	export const MAIL: string;
	export const npm_config_registry: string;
	export const SYSTEMD_SLEEP_FREEZE_USER_SESSIONS: string;
	export const __NV_PRIME_RENDER_OFFLOAD: string;
	export const npm_node_execpath: string;
	export const npm_config_engine_strict: string;
	export const OLDPWD: string;
	export const MODULES_CMD: string;
	export const TERM_PROGRAM: string;
}

/**
 * Similar to [`$env/static/private`](https://svelte.dev/docs/kit/$env-static-private), except that it only includes environment variables that begin with [`config.kit.env.publicPrefix`](https://svelte.dev/docs/kit/configuration#env) (which defaults to `PUBLIC_`), and can therefore safely be exposed to client-side code.
 * 
 * Values are replaced statically at build time.
 * 
 * ```ts
 * import { PUBLIC_BASE_URL } from '$env/static/public';
 * ```
 */
declare module '$env/static/public' {
	
}

/**
 * This module provides access to runtime environment variables, as defined by the platform you're running on. For example if you're using [`adapter-node`](https://github.com/sveltejs/kit/tree/main/packages/adapter-node) (or running [`vite preview`](https://svelte.dev/docs/kit/cli)), this is equivalent to `process.env`. This module only includes variables that _do not_ begin with [`config.kit.env.publicPrefix`](https://svelte.dev/docs/kit/configuration#env) _and do_ start with [`config.kit.env.privatePrefix`](https://svelte.dev/docs/kit/configuration#env) (if configured).
 * 
 * This module cannot be imported into client-side code.
 * 
 * Dynamic environment variables cannot be used during prerendering.
 * 
 * ```ts
 * import { env } from '$env/dynamic/private';
 * console.log(env.DEPLOYMENT_SPECIFIC_VARIABLE);
 * ```
 * 
 * > In `dev`, `$env/dynamic` always includes environment variables from `.env`. In `prod`, this behavior will depend on your adapter.
 */
declare module '$env/dynamic/private' {
	export const env: {
		IMSETTINGS_INTEGRATE_DESKTOP: string;
		SHELL: string;
		LSCOLORS: string;
		npm_command: string;
		SESSION_MANAGER: string;
		USER_ZDOTDIR: string;
		COLORTERM: string;
		XDG_CONFIG_DIRS: string;
		LESS: string;
		XDG_SESSION_PATH: string;
		HISTCONTROL: string;
		XDG_MENU_PREFIX: string;
		TERM_PROGRAM_VERSION: string;
		CONDA_EXE: string;
		HOSTNAME: string;
		HISTSIZE: string;
		ICEAUTHORITY: string;
		LANGUAGE: string;
		_P9K_TTY: string;
		NODE: string;
		JAVA_HOME: string;
		DOTNET_ROOT: string;
		QT_LOGGING_RULES: string;
		SSH_AUTH_SOCK: string;
		npm_config_verify_deps_before_run: string;
		GRADLE_HOME: string;
		P9K_TTY: string;
		MEMORY_PRESSURE_WRITE: string;
		SDKMAN_CANDIDATES_DIR: string;
		HOMEBREW_PREFIX: string;
		XMODIFIERS: string;
		DESKTOP_SESSION: string;
		GTK_RC_FILES: string;
		NO_AT_BRIDGE: string;
		GDK_CORE_DEVICE_EVENTS: string;
		__zsh_config_dir: string;
		GPG_TTY: string;
		XML_CATALOG_FILES: string;
		EDITOR: string;
		XDG_SEAT: string;
		PWD: string;
		XDG_SESSION_DESKTOP: string;
		LOGNAME: string;
		XDG_SESSION_TYPE: string;
		CONDA_PREFIX: string;
		MODULESHOME: string;
		MAMBA_ROOT_PREFIX: string;
		MANPATH: string;
		PNPM_HOME: string;
		__GL_SHOW_GRAPHICS_OSD: string;
		SYSTEMD_EXEC_PID: string;
		XAUTHORITY: string;
		SDL_VIDEO_MINIMIZE_ON_FOCUS_LOSS: string;
		VSCODE_GIT_ASKPASS_NODE: string;
		VSCODE_INJECTION: string;
		XKB_DEFAULT_MODEL: string;
		GTK2_RC_FILES: string;
		__MODULES_SHARE_MANPATH: string;
		HOME: string;
		SSH_ASKPASS: string;
		LANG: string;
		LS_COLORS: string;
		XDG_CURRENT_DESKTOP: string;
		npm_package_version: string;
		__zsh_user_data_dir: string;
		MEMORY_PRESSURE_WATCH: string;
		WAYLAND_DISPLAY: string;
		CONDA_PROMPT_MODIFIER: string;
		GIT_ASKPASS: string;
		XDG_SEAT_PATH: string;
		INVOCATION_ID: string;
		MANAGERPID: string;
		IMSETTINGS_MODULE: string;
		INIT_CWD: string;
		DOTNET_BUNDLE_EXTRACT_BASE_DIR: string;
		CHROME_DESKTOP: string;
		STEAM_FRAME_FORCE_CLOSE: string;
		KDE_SESSION_UID: string;
		INFOPATH: string;
		npm_lifecycle_script: string;
		MOZ_GMP_PATH: string;
		VSCODE_GIT_ASKPASS_EXTRA_ARGS: string;
		XKB_DEFAULT_LAYOUT: string;
		XDG_SESSION_CLASS: string;
		MAMBA_EXE: string;
		TERM: string;
		npm_package_name: string;
		ZSH: string;
		VSCODE_NONCE: string;
		ZDOTDIR: string;
		LESSOPEN: string;
		USER: string;
		npm_config_frozen_lockfile: string;
		KOTLIN_HOME: string;
		VSCODE_GIT_IPC_HANDLE: string;
		HOMEBREW_CELLAR: string;
		CONDA_SHLVL: string;
		MODULES_RUN_QUARANTINE: string;
		QT_WAYLAND_RECONNECT: string;
		KDE_SESSION_VERSION: string;
		PAM_KWALLET5_LOGIN: string;
		MAVEN_HOME: string;
		LOADEDMODULES: string;
		SDKMAN_DIR: string;
		DISPLAY: string;
		npm_lifecycle_event: string;
		SHLVL: string;
		MOZ_ENABLE_WAYLAND: string;
		PAGER: string;
		HOMEBREW_REPOSITORY: string;
		_P9K_SSH_TTY: string;
		XDG_VTNR: string;
		SDKMAN_CANDIDATES_API: string;
		XDG_SESSION_ID: string;
		npm_config_user_agent: string;
		PNPM_SCRIPT_SRC_DIR: string;
		npm_execpath: string;
		CONDA_PYTHON_EXE: string;
		LD_LIBRARY_PATH: string;
		NIX_REMOTE: string;
		XDG_RUNTIME_DIR: string;
		NODE_PATH: string;
		CONDA_DEFAULT_ENV: string;
		__MODULES_LMINIT: string;
		TOMCAT_HOME: string;
		DEBUGINFOD_URLS: string;
		LC_TIME: string;
		BUN_INSTALL: string;
		DEBUGINFOD_IMA_CERT_PATH: string;
		P9K_SSH: string;
		LC_ALL: string;
		KDEDIRS: string;
		MAVEN_OPTS: string;
		XKB_DEFAULT_VARIANT: string;
		VSCODE_GIT_ASKPASS_MAIN: string;
		QT_AUTO_SCREEN_SCALE_FACTOR: string;
		JOURNAL_STREAM: string;
		XDG_DATA_DIRS: string;
		GDK_BACKEND: string;
		KDE_FULL_SESSION: string;
		PATH: string;
		__GLX_VENDOR_LIBRARY_NAME: string;
		npm_config_node_gyp: string;
		MODULEPATH: string;
		ORIGINAL_XDG_CURRENT_DESKTOP: string;
		DBUS_SESSION_BUS_ADDRESS: string;
		SDKMAN_PLATFORM: string;
		KDE_APPLICATIONS_AS_SCOPE: string;
		__zsh_cache_dir: string;
		__VK_LAYER_NV_optimus: string;
		MAIL: string;
		npm_config_registry: string;
		SYSTEMD_SLEEP_FREEZE_USER_SESSIONS: string;
		__NV_PRIME_RENDER_OFFLOAD: string;
		npm_node_execpath: string;
		npm_config_engine_strict: string;
		OLDPWD: string;
		MODULES_CMD: string;
		TERM_PROGRAM: string;
		[key: `PUBLIC_${string}`]: undefined;
		[key: `${string}`]: string | undefined;
	}
}

/**
 * Similar to [`$env/dynamic/private`](https://svelte.dev/docs/kit/$env-dynamic-private), but only includes variables that begin with [`config.kit.env.publicPrefix`](https://svelte.dev/docs/kit/configuration#env) (which defaults to `PUBLIC_`), and can therefore safely be exposed to client-side code.
 * 
 * Note that public dynamic environment variables must all be sent from the server to the client, causing larger network requests — when possible, use `$env/static/public` instead.
 * 
 * Dynamic environment variables cannot be used during prerendering.
 * 
 * ```ts
 * import { env } from '$env/dynamic/public';
 * console.log(env.PUBLIC_DEPLOYMENT_SPECIFIC_VARIABLE);
 * ```
 */
declare module '$env/dynamic/public' {
	export const env: {
		[key: `PUBLIC_${string}`]: string | undefined;
	}
}
