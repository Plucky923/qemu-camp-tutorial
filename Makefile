.DEFAULT_GOAL := help

PYTHON ?= python3
NPM ?= npm
VENV_DIR ?= .venv
VENV_BIN := $(VENV_DIR)/bin
VENV_PYTHON := $(VENV_BIN)/python
PIP := $(VENV_PYTHON) -m pip
ZENSICAL := $(VENV_BIN)/zensical
AUTOCORRECT := node_modules/.bin/autocorrect
MARKDOWNLINT := node_modules/.bin/markdownlint-cli2
PYTHON_STAMP := $(VENV_DIR)/.requirements.stamp
NODE_STAMP := .node_modules.stamp
MD_FILES ?= $(shell { \
	git diff --name-only --diff-filter=ACMRTUXB -- '*.md'; \
	git diff --cached --name-only --diff-filter=ACMRTUXB -- '*.md'; \
	git ls-files --others --exclude-standard -- '*.md'; \
} 2>/dev/null | sed '/^$$/d; /^node_modules\//d; /^\.venv\//d; /^site\//d; /^\.claude\//d' | sort -u)
MD_PATHS = $(foreach file,$(MD_FILES),:$(file))

.PHONY: help venv setup install install-python install-node format lint mdformat mdlint serve build clean distclean shell

help: ## 显示可用命令
	@awk 'BEGIN {FS = ":.*## "; printf "Usage: make <target>\n\nTargets:\n"} /^[a-zA-Z0-9_.-]+:.*## / {printf "  %-16s %s\n", $$1, $$2}' $(MAKEFILE_LIST)

$(VENV_PYTHON): ## 创建 Python 虚拟环境
	$(PYTHON) -m venv $(VENV_DIR)
	$(PIP) install --upgrade pip

venv: $(VENV_PYTHON) ## 创建 .venv

$(PYTHON_STAMP): requirements.txt | $(VENV_PYTHON)
	$(PIP) install -r requirements.txt
	@touch $(PYTHON_STAMP)

install-python: $(PYTHON_STAMP) ## 安装 Python 依赖

$(NODE_STAMP): package.json package-lock.json
	$(NPM) install
	@touch $(NODE_STAMP)

install-node: $(NODE_STAMP) ## 安装 Node 依赖

setup: install ## 初始化开发环境

install: install-python install-node ## 安装全部依赖

format: install-node ## 自动修复中文排版
	$(AUTOCORRECT) --fix .

lint: install-node ## 检查中文排版
	$(AUTOCORRECT) --lint .

mdformat: install-node ## 自动修复已修改/新增的 Markdown 文件
	@if [ -z "$(strip $(MD_FILES))" ]; then \
		echo '没有检测到已修改的 Markdown 文件；可用 make mdformat MD_FILES="README.md"' ; \
	else \
		$(MARKDOWNLINT) --fix $(MD_PATHS); \
	fi

mdlint: install-node ## 严格检查已修改/新增的 Markdown 文件
	@if [ -z "$(strip $(MD_FILES))" ]; then \
		echo '没有检测到已修改的 Markdown 文件；可用 make mdlint MD_FILES="README.md"' ; \
	else \
		$(MARKDOWNLINT) $(MD_PATHS); \
	fi

serve: install-python ## 启动本地文档预览（自动使用 .venv）
	$(ZENSICAL) serve

build: install-python ## 构建文档站点
	$(ZENSICAL) build --clean

clean: ## 清理构建产物与缓存
	rm -rf site .cache

distclean: clean ## 同时删除依赖环境
	rm -rf $(VENV_DIR) node_modules $(NODE_STAMP)

shell: install-python ## 打开一个已加载 .venv 的交互 shell
	@PATH="$(abspath $(VENV_BIN)):$$PATH" VIRTUAL_ENV="$(abspath $(VENV_DIR))" exec "$${SHELL:-/bin/sh}" -i
