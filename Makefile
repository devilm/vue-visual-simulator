.PHONY: install build run

GH_PAGES_REPO ?= vue-visual-simulator
export GH_PAGES_REPO

ifeq ($(OS),Windows_NT)
NODEJS_DIR ?= C:/Program Files/nodejs
export PATH := $(NODEJS_DIR);$(PATH)
NPM ?= npm.cmd
else
NPM ?= npm
endif

install:
	$(NPM) install

build:
	$(NPM) run build:docs

run:
	$(NPM) run serve
