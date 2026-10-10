.PHONY: build

GH_PAGES_REPO ?= vue-visual-simulator
export GH_PAGES_REPO

build:
	npm run build:docs
