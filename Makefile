NODE_BIN=./node_modules/.bin

theme_srcs=$(wildcard src/theme/* src/theme/images/*)
client_bundle=build/client.bundle.js

all: demo

build/cli.js: $(app_srcs) $(theme_srcs)
	${NODE_BIN}/tsc
	cp -R src/theme build/

$(client_bundle): build/cli.js webpack.config.js
	NODE_ENV=production webpack -p

build/theme/theme.css: build/theme build/cli.js src/theme/base.css
	${NODE_BIN}/ts-style $(wildcard build/views/*.js) > build/app-theme.css
	cat src/theme/base.css > $@
	cat build/app-theme.css >> $@

demo: build/cli.js build/theme build/theme/theme.css $(client_bundle)
	node build/cli.js example-blog

clean:
	rm -rf build
