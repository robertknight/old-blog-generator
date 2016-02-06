import fs = require('fs');
import fs_extra = require('fs-extra');
import js_yaml = require('js-yaml');
import mustache = require('mustache');
import path = require('path');
import react = require('react');
import react_router = require('react-router');

import components = require('./components');
import data_source = require('./data_source');
import fs_util = require('./fs_util');
import post_view = require('./views/post');
import routes = require('./routes');
import scanner = require('./scanner');

// name of the style file to use for syntax highlighting
// from highlight.js' styles/ dir
const CODE_THEME = 'zenburn.css';

class ComponentLoader implements components.Loader {
	private componentsDir: string;

	constructor(componentsDir: string) {
		this.componentsDir = componentsDir;
	}

	load(name: string) {
		const searchPaths = [
			path.resolve(this.componentsDir),
			path.resolve(path.resolve(__dirname) + '/components')
		];
		let component: react.Component<any,any>;

		searchPaths.some((searchPath) => {
			try {
				const componentPath = searchPath + '/' + name;

				// test that the referenced component exists
				fs.statSync(componentPath + '.js');

				component = <react.Component<any,any>>require(componentPath);
				return true;
			} catch (ex) {
				// if the component does not exist, try the next search path,
				// otherwise alert the caller
				if (ex.code !== 'ENOENT') {
					throw ex;
				}
				return false;
			}
		});

		if (component) {
			return component;
		} else {
			throw new Error(`Failed to load component ${name}`);
		}
	}
}

function prerenderRoute(config: scanner.SiteConfig, route: string, outputDir: string, data: routes.AppDataSource) {
	console.log(`Creating ${route}`);
	var template = fs.readFileSync(path.resolve(__dirname) + '/../src/index.html').toString();
	react_router.run(<react_router.Route>routes.rootRoute, route, (handler, state) => {
		var props = routes.fetchRouteProps(data, state);

		// render route
		var body = react.renderToString(react.createElement(handler, props));
		var html = mustache.render(template, {
			title: props.title,
			body: body,
			appTheme: `${config.rootUrl}/theme/theme.css`,
			appRoot: config.rootUrl,
			codeTheme: `${config.rootUrl}/theme/${CODE_THEME}`,
			bundles: ['vendor','client','components'].map(name => `${config.rootUrl}/${name}.bundle.js`)
		});
		fs_extra.ensureDirSync(outputDir);
		fs.writeFileSync(`${outputDir}/index.html`, html);
	});
}

function readConfig(dir: string) {
	const configPath = dir + '/_config.yml';
	if (!fs.existsSync(configPath)) {
		throw new Error(`No config.yml file found in ${dir}`);
	}

	const configYaml = js_yaml.safeLoad(fs.readFileSync(configPath).toString());
	const author = <scanner.SiteAuthor>configYaml.author || {};
	const config = <scanner.SiteConfig>{
		inputDir: dir,
		title: <string>configYaml.title,
		outputDir: path.resolve(`${dir}/${<string>configYaml.outputDir || '_site'}`),
		componentsDir: path.resolve(`${dir}/components`),
		rootUrl: <string>configYaml.rootUrl || '',
		author: author
	};
	return config;
}

function readPosts(config: scanner.SiteConfig) {
	var postsDir = config.inputDir + '/_posts';
	return fetchPosts(postsDir);
}

function fetchPosts(postsDir: string) {
	var posts: scanner.PostContent[] = [];
	var postSourceFiles = fs.readdirSync(postsDir);
	postSourceFiles.forEach((filename) => {
		var postFilePath = path.join(postsDir, filename);
		var ext = path.extname(filename);
		if (ext === '.md') {
			posts.push(scanner.parsePostContent(postFilePath, fs.readFileSync(postFilePath).toString()));
		}
	});
	return posts.sort((a, b) => {
    // sort the posts in descending date order,
    // assuming that the post dates are formatted
    // YYYY-MM-DD so that the lexicographical and
    // chronological orders are the same
    const [aDate, bDate] = [a.metadata.date, b.metadata.date];
    return aDate > bDate ? -1 : 1;
  });
}

export function generateBlog(dir: string) {
	// remove and re-create output dir
	const config = readConfig(dir);
	fs_extra.ensureDirSync(config.outputDir);
	fs_util.cleanDir(config.outputDir, outputPath => {
		return path.basename(outputPath)[0] !== '.';
	});
	
	// generate post and tag indexes
	const posts = readPosts(config);
	const tags = scanner.generateTagMap(posts);

	// pre-render routes
	let prerenderedRoutes = ['/'];

	posts.forEach(post => {
		prerenderedRoutes.push(`/posts/${post.metadata.slug}`);
	});

	Object.keys(tags).forEach(tag => {
		prerenderedRoutes.push(`/posts/tagged/${tag}`);
	});

	let componentLoader = new ComponentLoader(config.componentsDir);
	let dataSource = new data_source.DataSource(componentLoader, config, posts, tags);
	prerenderedRoutes.forEach(route => {
		prerenderRoute(config, route, config.outputDir + route, dataSource);
	});

	// generate route data file
	const routeData = {
		config: config,
		posts: posts,
		tags: tags
	};
	const routeDataFile = `${config.outputDir}/data.json`;
	fs.writeFileSync(routeDataFile, JSON.stringify(routeData, null, 2));

	// copy app bundles
	const bundles = ['vendor','client','components'];
	bundles.forEach(bundle => {
		const bundleSrc = `${path.resolve(__dirname)}/${bundle}.bundle.js`;
		const bundleDest =`${config.outputDir}/${bundle}.bundle.js`;
		fs_extra.copy(bundleSrc, bundleDest, err => {
			if (err) {
				console.error(`Failed to copy client app: ${err}`);
			}
		});
	});

	// copy theme files
	const codeTheme = `${path.resolve(__dirname)}/../node_modules/highlight.js/styles/${CODE_THEME}`;
	const themeFiles = ['theme.css', 'images', codeTheme];
	const themeInputDir = path.resolve(__dirname) + '/theme';
	const themeOutputDir = `${config.outputDir}/theme`;

	themeFiles.forEach(themeFile => {
		let src = themeFile;
		if (fs_util.isRelative(themeFile)) {
			src = `${themeInputDir}/${themeFile}`;
		}
		const dest = `${themeOutputDir}/${path.basename(themeFile)}`;
		fs_extra.copy(src, dest, (err) => {
			if (err) {
				console.error(`Failed to copy ${src} to ${dest}: ${err}`);
			}
		});
	});

	// copy site assets
	fs_extra.copy(dir + '/assets', `${config.outputDir}/assets`, () => {});
}

