.PHONY: build publish test

build:
	yarn run build

# following https://booker.codes/how-to-build-and-publish-es6-npm-modules-today-with-babel/ for transpiled npm packages
publish: build
	npm publish
