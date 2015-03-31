import react = require('react');
import style = require('ts-style');

var theme = style.create({
	topBanner: {
		display: 'flex',
		flexDirection: 'row',
		alignContent: 'center',
		borderBottom: '1px solid #ddd',
		padding: 5,

		' a': { textDecoration: 'none' }
	},

	name: {
		fontSize: 20
	},

	nameSeparator: {
		display: 'inline-block',
		borderLeft: '1px solid #bbb',
		marginLeft: 10,
		marginRight: 10
	}

});

export interface SocialLinks {
	twitter: string;
	github: string;
}

export interface BannerProps {
	name: string;
	photoUrl: string;
	socialLinks: SocialLinks;
	rootUrl: string;
}

function twitterUrl(id: string) {
	return `https://twitter.com/${id}`;
}

function githubUrl(id: string) {
	return `https://github.com/${id}`;
}

/** Banner displayed at the top of the blog with author
  * details.
  */
export class Banner extends react.Component<BannerProps, {}> {
	render() {
		var socialLinks: react.ReactNode[] = [];
		if (this.props.socialLinks.twitter) {
			socialLinks.push(react.DOM.a({
				href: twitterUrl(this.props.socialLinks.twitter),
				key: 'twitter'
			},
				`@${this.props.socialLinks.twitter}`
			));
		}
		if (this.props.socialLinks.github) {
			socialLinks.push(react.DOM.a({
				href: githubUrl(this.props.socialLinks.github),
				key: 'github'
			}, 'GitHub'));
		}

		return react.DOM.div(style.mixin(theme.topBanner),
			react.DOM.span(style.mixin(theme.name),
				react.DOM.a({href: this.props.rootUrl}, this.props.name)
			),
			react.DOM.span(style.mixin(theme.nameSeparator)),
			socialLinks
		);
	}
}

export var BannerF = react.createFactory(Banner);

