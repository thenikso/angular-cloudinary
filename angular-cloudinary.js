(function () {
'use strict';

if (typeof require !== 'undefined') {
	require('ng-file-upload');
}

var OLD_AKAMAI_SHARED_CDN = "cloudinary-a.akamaihd.net";
var AKAMAI_SHARED_CDN = "res.cloudinary.com";
var SHARED_CDN = AKAMAI_SHARED_CDN;

var angularModule = angular.module('angular-cloudinary', [
	'ngFileUpload',
]);

var cloudinaryAttr = function(attr){
	if (attr.match(/cl[A-Z]/)) attr = attr.substring(2);
	return attr.replace('-', '_').replace(/([a-z])([A-Z])/g,'$1_$2').toLowerCase();
};

['Src', 'Srcset', 'Href'].forEach(function(attrName) {
	var normalized = 'cl' + attrName;
	attrName = attrName.toLowerCase();
	angularModule.directive(normalized, ['$sniffer', 'cloudinary', function($sniffer, cloudinary) {
		return {
			priority: 99, // it needs to run after the attributes are interpolated
			link: function(scope, element, attr) {
				var propName = attrName,
						name = attrName;

				if (attrName === 'href' &&
						toString.call(element.prop('href')) === '[object SVGAnimatedString]') {
					name = 'xlinkHref';
					attr.$attr[name] = 'xlink:href';
					propName = null;
				}

				attr.$observe(normalized, function(value) {
					if (!value)
						 return;

					var attributes = {};
					angular.forEach(element[0].attributes, function(v){attributes[cloudinaryAttr(v.name)] = v.value});
					value = cloudinary.url(value, attributes);
					attr.$set(name, value);

					// on IE, if "ng:src" directive declaration is used and "src" attribute doesn't exist
					// then calling element.setAttribute('src', 'foo') doesn't do anything, so we need
					// to set the property as well to achieve the desired effect.
					// we use attr[attrName] value since $set can sanitize the url.
					if ($sniffer.msie && propName) element.prop(propName, attr[name]);
				});
			}
		};
	}]);
});

angularModule.directive('clTransformation', [function() {
	return {
		restrict : 'E',
		transclude : false,
		require: '^clImage',
		link : function (scope, element, attrs, clImageCtrl) {
			var attributes = {};
			angular.forEach(attrs, function(value, name){
				if (name[0] !== '$') {
					attributes[cloudinaryAttr(name)] = value;
				}
			});
			clImageCtrl.addTransformation(attributes);
		}
	}
}]);

angularModule.directive('clImage', ['cloudinary', function(cloudinary) {
	var Controller = function($scope) {
		this.addTransformation = function(ts) {
			$scope.transformations = $scope.transformations || [];
			$scope.transformations.push(ts);
		}
	};
	Controller.$inject = ['$scope'];
	return {
		restrict : 'E',
		replace: true,
		transclude : true,
		template: "<img ng-transclude/>",
		scope: {},
		priority: 99,
		controller: Controller,
		// The linking function will add behavior to the template
		link : function(scope, element, attrs) {
			var attributes = {};
			var publicId = null;

			angular.forEach(attrs, function(value, name){attributes[cloudinaryAttr(name)] = value});

			if (scope.transformations) {
				attributes.transformation = scope.transformations;
			}

			// store public id and load image
			attrs.$observe('publicId', function(value){
				if (!value) return;
				publicId = value
				loadImage();
			});

			// observe and update version attribute
			attrs.$observe('version', function(value){
				if (!value) return;
				attributes['version'] = value;
				loadImage();
			});

			if (attrs.htmlWidth) {
				element.attr("width", attrs.htmlWidth);
			} else {
				element.removeAttr("width");
			}
			if (attrs.htmlHeight) {
				element.attr("height", attrs.htmlHeight);
			} else {
				element.removeAttr("height");
			}

			var loadImage = function() {
				var url = cloudinary.url(publicId, attributes);
				element.attr('src', url);
			}

		}
	};
}]);

angularModule.directive('clVideo', ['cloudinary', function(cloudinary) {
	return {
		restrict: 'E',
		scope: {},
		priority: 99,
		replace: true,
		transclude: true,
		template: '<div ngTransclude></div>',
		link: function (scope, element, attrs) {
			var attributes = {};
			var publicId = null;

			angular.forEach(attrs, function(value, name) {
				var key = cloudinaryAttr(name);
				if (key[0] === '$') return;
				attributes[key] = value;
			});

			if (scope.transformations) {
				attributes.transformation = scope.transformations;
			}

			attrs.$observe('publicId', function(value){
				if (!value) return;
				publicId = value;
				loadVideo();
			});

			function loadVideo () {
				var videoElement = cloudinary.video(publicId, attributes);
				element.empty().append(videoElement);
			}
		}
	}
}]);

angularModule.filter('clUrl', ['cloudinary', function(cloudinary) {
	return function (input, options) {
		return cloudinary.url(input, options || {});
	}
}]);

angularModule.provider('cloudinary', function () {
	var config = {
		upload_endpoint: 'https://api.cloudinary.com/v1_1/'
	};

	this.config = function (obj) {
		angular.extend(config, obj);
	};

	this.$get = ['Upload', function (Upload) {
		return {
			url: cloudinary_url,
			upload: upload,
			video: createVideoElement,
		};

		function upload (file, options) {
			var cloud_name = options.cloud_name || config.cloud_name
			if (config.upload_preset) {
				options = angular.extend({
					upload_preset: config.upload_preset
				}, options);
			}
			return Upload.upload({
				url: config.upload_endpoint + cloud_name + '/upload',
				fields: options,
				file: file
			});
		}
	}];

	function cloudinary_url(public_id, options) {
		options = options || {};
		var type = option_consume(options, 'type', 'upload');
		if (type == 'fetch') {
			options.fetch_format = options.fetch_format || option_consume(options, 'format');
		}
		var transformation = generate_transformation_string(options);
		var resource_type = option_consume(options, 'resource_type', "image");
		var version = option_consume(options, 'version');
		var format = option_consume(options, 'format');
		var cloud_name = option_consume(options, 'cloud_name', config.cloud_name);
		if (!cloud_name) throw "Unknown cloud_name";
		var private_cdn = option_consume(options, 'private_cdn', config.private_cdn);
		var secure_distribution = option_consume(options, 'secure_distribution', config.secure_distribution);
		var cname = option_consume(options, 'cname', config.cname);
		var cdn_subdomain = option_consume(options, 'cdn_subdomain', config.cdn_subdomain);
		var secure_cdn_subdomain = option_consume(options, 'secure_cdn_subdomain', config.secure_cdn_subdomain);
		var shorten = option_consume(options, 'shorten', config.shorten);
		var secure = option_consume(options, 'secure', window.location.protocol == 'https:');
		var protocol = option_consume(options, 'protocol', config.protocol);
		var trust_public_id = option_consume(options, 'trust_public_id');
		var url_suffix = option_consume(options, 'url_suffix');
		var use_root_path = option_consume(options, 'use_root_path', config.use_root_path);
		if (!private_cdn) {
			if (url_suffix) throw "URL Suffix only supported in private CDN";
			if (use_root_path) throw "Root path only supported in private CDN";
		}

		if (type == 'fetch') {
			public_id = absolutize(public_id);
		}

		if (public_id.search("/") >= 0 && !public_id.match(/^v[0-9]+/) && !public_id.match(/^https?:\//) && !present(version)) {
			version = 0;
		}

		if (public_id.match(/^https?:/)) {
			if (type == "upload" || type == "asset") return public_id;
			public_id = encodeURIComponent(public_id).replace(/%3A/g, ":").replace(/%2F/g, "/");
		} else {
			// Make sure public_id is URI encoded.
			public_id = encodeURIComponent(decodeURIComponent(public_id)).replace(/%3A/g, ":").replace(/%2F/g, "/");
			if (url_suffix) {
				if (url_suffix.match(/[\.\/]/)) throw "url_suffix should not include . or /";
				public_id = public_id + "/" + url_suffix;
			}

			if (format) {
				if (!trust_public_id) public_id = public_id.replace(/\.(jpg|png|gif|webp)$/, '');
				public_id = public_id + "." + format;
			}
		}

		var resource_type_and_type = finalize_resource_type(resource_type, type, url_suffix, use_root_path, shorten);

		var prefix = cloudinary_url_prefix(public_id, cloud_name, private_cdn, cdn_subdomain, secure_cdn_subdomain, cname, secure, secure_distribution, protocol);

		var url = [prefix, resource_type_and_type, transformation, version ? "v" + version : "",
							 public_id].join("/").replace(/([^:])\/+/g, '$1/');
		return url;
	}

	function createVideoElement (public_id, options) {
		options = options || {};
		public_id = public_id.replace(/\.(mp4|ogv|webm)$/, '');
		var source_types = option_consume(options, 'source_types', []);
		var source_transformation = option_consume(options, 'source_transformation', {});
		var fallback = option_consume(options, 'fallback_content', '');

		if (source_types.length == 0) source_types = DEFAULT_VIDEO_SOURCE_TYPES;
		var video_options = angular.copy(options);

		if (video_options.hasOwnProperty('poster')) {
			if (angular.isObject(video_options.poster)) {
				if (video_options.poster.hasOwnProperty('public_id')) {
					video_options.poster = cloudinary_url(video_options.poster.public_id, video_options.poster);
				} else {
					video_options.poster = cloudinary_url(public_id, angular.extend({}, DEFAULT_POSTER_OPTIONS, video_options.poster));
				}
			}
		} else {
			video_options.poster = cloudinary_url(public_id, angular.extend({}, DEFAULT_POSTER_OPTIONS, options));
		}

		if (!video_options.poster) delete video_options.poster;

		var html = '<video ';

		if (!video_options.hasOwnProperty('resource_type')) video_options.resource_type = 'video';
		var multi_source = angular.isArray(source_types) && source_types.length > 1;
		var source = public_id;
		if (!multi_source){
			source = source + '.' + build_array(source_types)[0];
		}
		var src = cloudinary_url(source, video_options);
		if (!multi_source) video_options.src = src;
		if (video_options.hasOwnProperty("html_width")) video_options.width = option_consume(video_options, 'html_width');
		if (video_options.hasOwnProperty("html_height")) video_options.height = option_consume(video_options, 'html_height');
		html = html + html_attrs(video_options) + '>';
		if (multi_source) {
			for(var i = 0; i < source_types.length; i++) {
				var source_type = source_types[i];
				var transformation = source_transformation[source_type] || {};
				src = cloudinary_url(source + "." + source_type, angular.extend({resource_type: 'video'}, options, transformation));
				var video_type = source_type == 'ogv' ? 'ogg' : source_type;
				var mime_type = "video/" + video_type;
				html = html + '<source '+ html_attrs({src: src, type: mime_type}) + '>';
			}
		}

		html = html + fallback;
		html = html + '</video>';
		return html;
	}

	function option_consume(options, option_name, default_value) {
		var result = options[option_name];
		delete options[option_name];
		return typeof(result) == 'undefined' ? default_value : result;
	}

	function generate_transformation_string(options) {
		var base_transformations = process_base_transformations(options);
		process_size(options);
		process_html_dimensions(options);

		var params = [];
		for (var param in TRANSFORMATION_PARAM_NAME_MAPPING) {
			var value = option_consume(options, param);
			if (!present(value)) continue;
			if (TRANSFORMATION_PARAM_VALUE_MAPPING[param]) {
				value = TRANSFORMATION_PARAM_VALUE_MAPPING[param](value);
			}
			if (!present(value)) continue;
			if (angular.isArray(value)) {
				var actual = [];
				for (var i = 0; i < value.length; i++) {
					actual.push(TRANSFORMATION_PARAM_NAME_MAPPING[param] + "_" + value[i]);
				}
				params.push(actual.join(','));
			}
			else {
				params.push(TRANSFORMATION_PARAM_NAME_MAPPING[param] + "_" + value);
			}
		}
		// params.sort();

		var raw_transformation = option_consume(options, 'raw_transformation');
		if (present(raw_transformation)) params.push(raw_transformation);
		var transformation = params.join(",");
		if (present(transformation)) base_transformations.push(transformation);
		return base_transformations.join("/");
	}

	function process_base_transformations(options) {
		var transformations = build_array(options.transformation);
		var all_named = true;
		for (var i = 0; i < transformations.length; i++) {
			all_named = all_named && typeof(transformations[i]) == 'string';
		}
		if (all_named) {
			return [];
		}
		delete options.transformation;
		var base_transformations = [];
		for (var i = 0; i < transformations.length; i++) {
			var transformation = transformations[i];
			if (typeof(transformation) == 'string') {
				base_transformations.push("t_" + transformation);
			} else {
				base_transformations.push(generate_transformation_string($.extend({}, transformation)));
			}
		}
		return base_transformations;
	}

	function build_array(arg) {
		if (arg === null || typeof(arg) == 'undefined') {
			return [];
		} else if (angular.isArray(arg)) {
			return arg;
		} else if (angular.isString(arg)) {
			return arg.split(',');
		} else {
			return [arg];
		}
	}

	function process_size(options) {
		var size = option_consume(options, 'size');
		if (size === 'fitScreen') {
			options.width = Math.min(1440, Math.max(screen.width, screen.height));
		}
		else if (size) {
			var split_size = size.split("x");
			options.width = split_size[0];
			options.height = split_size[1];
		}
	}

	function process_html_dimensions(options) {
		var width = options.width, height = options.height;
		var has_layer = options.overlay || options.underlay;
		var crop = options.crop;
		var use_as_html_dimensions = !has_layer && !options.angle && crop != "fit" && crop != "limit" && crop != "lfill";
		if (use_as_html_dimensions) {
			if (width && !options.html_width && width !== "auto" && parseFloat(width) >= 1) options.html_width = width;
			if (height && !options.html_height && parseFloat(height) >= 1) options.html_height = height;
		}
		if (!crop && !has_layer) {
			delete options.width;
			delete options.height;
		}
	}

	function html_attrs(attrs) {
		var pairs = [];
		angular.forEach(attrs, function(value, key) {
			pairs.push(join_pair(key, value));
		});
		pairs.sort();
		return pairs.filter(function(pair){return pair;}).join(" ");
	}

	function join_pair(key, value) {
		if (!value) {
			return undefined;
		} else if (value === true) {
			return key;
		} else {
			return key + "=\"" + value + "\"";
		}
	}

	var TRANSFORMATION_PARAM_NAME_MAPPING = {
		width: 'w',
		height: 'h',
		angle: 'a',
		background: 'b',
		border: 'bo',
		color: 'co',
		color_space: 'cs',
		crop: 'c',
		default_image: 'd',
		delay: 'dl',
		density: 'dn',
		dpr: 'dpr',
		effect: 'e',
		fetch_format: 'f',
		flags: 'fl',
		opacity: 'o',
		overlay: 'l',
		page: 'pg',
		prefix: 'p',
		quality: 'q',
		radius: 'r',
		transformation: 't',
		underlay: 'u',
		gravity: 'g',
		x: 'x',
		y: 'y'
	};

	var TRANSFORMATION_PARAM_VALUE_MAPPING = {
		angle: function(angle){ return build_array(angle).join("."); },
		background: function(background) { return background.replace(/^#/, 'rgb:');},
		border: function(border) {
			if ($.isPlainObject(border)) {
				var border_width = "" + (border.width || 2);
				var border_color = (border.color || "black").replace(/^#/, 'rgb:');
				border = border_width + "px_solid_" + border_color;
			}
			return border;
		},
		color: function(color) { return color.replace(/^#/, 'rgb:');},
		dpr: function(dpr) {
			dpr = dpr.toString();
			if (dpr === "auto") {
				if (window.devicePixelRatio) {
					return Math.round(window.devicePixelRatio).toFixed(1);
				}
				else if (isRetina()) {
					return '2.0';
				}
				else {
					return '1.0';
				}
			} else if (dpr.match(/^\d+$/)) {
				return dpr + ".0";
			} else {
				return dpr;
			}
		},
		effect: function(effect) { return build_array(effect); },
		flags: function(flags) { return build_array(flags); },
		transformation: function(transformation) { return build_array(transformation).join(".")}
	};

	var DEFAULT_POSTER_OPTIONS = { format: 'jpg', resource_type: 'video' };

	var DEFAULT_VIDEO_SOURCE_TYPES = ['webm', 'mp4', 'ogv'];

	function isRetina(){
	  return ((window.matchMedia && (window.matchMedia('only screen and (min-resolution: 192dpi), only screen and (min-resolution: 2dppx), only screen and (min-resolution: 75.6dpcm)').matches || window.matchMedia('only screen and (-webkit-min-device-pixel-ratio: 2), only screen and (-o-min-device-pixel-ratio: 2/1), only screen and (min--moz-device-pixel-ratio: 2), only screen and (min-device-pixel-ratio: 2)').matches)) || (window.devicePixelRatio && window.devicePixelRatio > 2)) && /(iPad|iPhone|iPod)/g.test(navigator.userAgent);
	}

	function present(value) {
		return typeof value != 'undefined' && ("" + value).length > 0;
	}

	function finalize_resource_type(resource_type, type, url_suffix, use_root_path, shorten) {
		var resource_type_and_type = resource_type + "/" + type;
		if (url_suffix) {
			if (resource_type_and_type == "image/upload") {
				resource_type_and_type = "images";
			} else if (resource_type_and_type == "raw/upload") {
				resource_type_and_type = "files";
			} else {
				throw "URL Suffix only supported for image/upload and raw/upload";
			}
		}
		if (use_root_path) {
			if (resource_type_and_type == "image/upload" || resource_type_and_type == "images") {
				resource_type_and_type = "";
			} else {
				throw "Root path only supported for image/upload";
			}
		}
		if (shorten && resource_type_and_type == "image/upload") {
			resource_type_and_type = "iu";
		}
		return resource_type_and_type;
	}

	function cloudinary_url_prefix(public_id, cloud_name, private_cdn, cdn_subdomain, secure_cdn_subdomain, cname, secure, secure_distribution, protocol) {
		if (cloud_name.match(/^\//) && !secure) {
			return "/res" + cloud_name;
		}

		var prefix = secure ? 'https://' : (window.location.protocol === 'file:' ? "file://" : 'http://');
		prefix = protocol ? protocol + '//' : prefix;

		var shared_domain = !private_cdn;
		if (secure) {
			if (!secure_distribution || secure_distribution == OLD_AKAMAI_SHARED_CDN) {
				secure_distribution = private_cdn ? cloud_name + "-res.cloudinary.com" : SHARED_CDN;
			}
			shared_domain = shared_domain || secure_distribution == SHARED_CDN;
			if (secure_cdn_subdomain == null && shared_domain) {
				secure_cdn_subdomain = cdn_subdomain;
			}
			if (secure_cdn_subdomain) {
				secure_distribution = secure_distribution.replace('res.cloudinary.com', "res-" + ((crc32(public_id) % 5) + 1) + ".cloudinary.com");
			}
			prefix += secure_distribution;
		} else if (cname) {
			var subdomain = cdn_subdomain ? "a" + ((crc32(public_id) % 5) + 1) + "." : "";
			prefix += subdomain + cname;
		} else {
			prefix += (private_cdn ? cloud_name + "-res" : "res");
			prefix += (cdn_subdomain ? "-" + ((crc32(public_id) % 5) + 1) : "")
			prefix += ".cloudinary.com";
		}
		if (shared_domain) prefix += "/" + cloud_name;

		return prefix;
	}
});

if (typeof module !== 'undefined' && module && module.exports) {
  module.exports = angularModule;
}

return angularModule;

})();
