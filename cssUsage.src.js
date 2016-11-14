//
// Prepare the whole instrumentation world
//
void function() {
	
	/*	String hash function
	/*	credits goes to http://erlycoder.com/49/javascript-hash-functions-to-convert-string-into-integer-hash- */
	const hashCodeOf = (str) => {
		var hash = 5381; var char = 0;
		for (var i = 0; i < str.length; i++) {
			char = str.charCodeAt(i);
			hash = ((hash << 5) + hash) + char;
		}
		return hash;
	}
	
	var ua = navigator.userAgent;
	var uaName = ua.indexOf('Edge')>=0 ? 'EDGE' :ua.indexOf('Chrome')>=0 ? 'CHROME' : 'FIREFOX';
	window.INSTRUMENTATION_RESULTS = {
		UA: uaName,
		UASTRING: ua,
		UASTRING_HASH: hashCodeOf(ua),
		URL: location.href,
		TIMESTAMP: Date.now(),
		css: {/*  see CSSUsageResults  */},
		html: {/* see HtmlUsageResults */},
		dom: {},
		scripts: {/* "bootstrap.js": 1 */},
	};
	window.INSTRUMENTATION_RESULTS_TSV = [];
	
	/* make the script work in the context of a webview */
	try {
		var console = window.console || (window.console={log:function(){},warn:function(){},error:function(){}});
		console.unsafeLog = console.log;
		console.log = function() {
			try {
				this.unsafeLog.apply(this,arguments);
			} catch(ex) {
				// ignore
			}
		};
	} catch (ex) {
		// we tried...
	}	
}();

window.onCSSUsageResults = function onCSSUsageResults(CSSUsageResults) {

	// Collect the results (css)
	INSTRUMENTATION_RESULTS.css = CSSUsageResults;
	INSTRUMENTATION_RESULTS.html = HtmlUsageResults;
	INSTRUMENTATION_RESULTS.recipe = RecipeResults;
	
	// Convert it to a more efficient format
	INSTRUMENTATION_RESULTS_TSV = convertToTSV(INSTRUMENTATION_RESULTS);
	
	// Remove tabs and new lines from the data
	for(var i = INSTRUMENTATION_RESULTS_TSV.length; i--;) {
		var row = INSTRUMENTATION_RESULTS_TSV[i];
		for(var j = row.length; j--;) {
			row[j] = (''+row[j]).replace(/(\s|\r|\n)+/g, ' ');
		}
	}
	
	// Convert into one signle tsv file
	var tsvString = INSTRUMENTATION_RESULTS_TSV.map((row) => (row.join('\t'))).join('\n');
	if(window.debugCSSUsage) console.log(tsvString);
	
	// Add it to the document dom
	var output = document.createElement('script');
	output.id = "css-usage-tsv-results";
	output.textContent = tsvString;
    output.type = 'text/plain';
    document.querySelector('head').appendChild(output);

	/** convert the instrumentation results to a spreadsheet for analysis */
	function convertToTSV(INSTRUMENTATION_RESULTS) {
		
		var VALUE_COLUMN = 4;
		var finishedRows = [];
		var currentRowTemplate = [
			INSTRUMENTATION_RESULTS.UA,
			INSTRUMENTATION_RESULTS.UASTRING_HASH,
			INSTRUMENTATION_RESULTS.URL,
			INSTRUMENTATION_RESULTS.TIMESTAMP,
			0
		];
		
		currentRowTemplate.push('ua');
		convertToTSV({identifier: INSTRUMENTATION_RESULTS.UASTRING});
		currentRowTemplate.pop();
		
		currentRowTemplate.push('css');
		convertToTSV(INSTRUMENTATION_RESULTS['css']);
		currentRowTemplate.pop();
		
		currentRowTemplate.push('dom');
		convertToTSV(INSTRUMENTATION_RESULTS['dom']);
		currentRowTemplate.pop();

		currentRowTemplate.push('html');
		convertToTSV(INSTRUMENTATION_RESULTS['html']);
		currentRowTemplate.pop();

		currentRowTemplate.push('recipe');
		convertToTSV(INSTRUMENTATION_RESULTS['recipe']);
		currentRowTemplate.pop();
		
		//currentRowTemplate.push('scripts');
		//convertToTSV(INSTRUMENTATION_RESULTS['scripts']);
		//currentRowTemplate.pop();
		
		var l = finishedRows[0].length;
		finishedRows.sort((a,b) => {
			for(var i = VALUE_COLUMN+1; i<l; i++) {
				if(a[i]<b[i]) return -1;
				if(a[i]>b[i]) return +1;
			}
			return 0;
		});
		
		return finishedRows;
		
		/** helper function doing the actual conversion */
		function convertToTSV(object) {
			if(object==null || object==undefined || typeof object == 'number' || typeof object == 'string') {
				finishedRows.push(new Row(currentRowTemplate, ''+object));
			} else {
				for(var key in object) {
					if({}.hasOwnProperty.call(object,key)) {
						currentRowTemplate.push(key);
						convertToTSV(object[key]);
						currentRowTemplate.pop();
					}
				}
			}
		}
		
		/** constructor for a row of our table */
		function Row(currentRowTemplate, value) {
			
			// Initialize an empty row with enough columns
			var row = [
				/*UANAME:     edge                            */'',
				/*UASTRING:   mozilla/5.0 (...)               */'',
				/*URL:        http://.../...                  */'',
				/*TIMESTAMP:  1445622257303                   */'',
				/*VALUE:      0|1|...                         */'',
				/*DATATYPE:   css|dom|html...                     */'',
				/*SUBTYPE:    props|types|api|...             */'',
				/*NAME:       font-size|querySelector|...     */'',
				/*CONTEXT:    count|values|...                */'',
				/*SUBCONTEXT: px|em|...                       */'',
				/*...                                         */'',
				/*...                                         */'',
			];
			
			// Copy the column values from the template
			for(var i = currentRowTemplate.length; i--;) {
				row[i] = currentRowTemplate[i];
			}
			
			// Add the value to the row
			row[VALUE_COLUMN] = value;
			
			return row;
		}

	}
};
'use strict';

void function () {

	var _ = function _(a) {
		return new ArrayWrapper(a);
	};
	_.mapInline = mapInline;
	_.map = map;map.bind = function () {
		return map;
	};
	_.filter = filter;filter.bind = function () {
		return filter;
	};
	_.reduce = reduce;reduce.bind = function () {
		return reduce;
	};
	window.CSSUsageLodash = _;


	function ArrayWrapper(array) {
		this.source = array;
		this.mapInline = function (f) {
			mapInline(this.source, f);return this;
		};
		this.map = function (f) {
			this.source = map(this.source, f);return this;
		};
		this.filter = function (f) {
			this.source = filter(this.source, f);return this;
		};
		this.reduce = function (v, f) {
			this.source = reduce(this.source, f, v);return this;
		};
		this.value = function () {
			return this.source;
		};
	}

	function map(source, transform) {
		var clone = new Array(source.length);
		for (var i = source.length; i--;) {
			clone[i] = transform(source[i]);
		}
		return clone;
	}

	function mapInline(source, transform) {
		for (var i = source.length; i--;) {
			source[i] = transform(source[i]);
		}
		return source;
	}

	function filter(source, shouldValueBeIncluded) {
		var clone = new Array(source.length),
		    i = 0;
		for (var s = 0; s <= source.length; s++) {
			var value = source[s];
			if (shouldValueBeIncluded(value)) {
				clone[i++] = value;
			}
		}
		clone.length = i;
		return clone;
	}

	function reduce(source, computeReduction, reduction) {
		for (var s = 0; s <= source.length; s++) {
			var value = source[s];
			reduction = computeReduction(reduction, value);
		}
		return reduction;
	}
}();

void function () {
	var shorthands = this.shorthandProperties = {
		'list-style': ['-type', '-position', '-image'],
		'margin': ['-top', '-right', '-bottom', '-left'],
		'outline': ['-width', '-style', '-color'],
		'padding': ['-top', '-right', '-bottom', '-left'],

		'background': ['-image', '-position', '-size', '-repeat', '-origin', '-clip', '-attachment', '-color'],
		'background-repeat': ['-x', '-y'],
		'background-position': ['-x', '-y'],
		'border': ['-width', '-style', '-color'],
		'border-color': ['border-top-color', 'border-right-color', 'border-bottom-color', 'border-left-color'],
		'border-style': ['border-top-style', 'border-right-style', 'border-bottom-style', 'border-left-style'],
		'border-width': ['border-top-width', 'border-right-width', 'border-bottom-width', 'border-left-width'],
		'border-top': ['-width', '-style', '-color'],
		'border-right': ['-width', '-style', '-color'],
		'border-bottom': ['-width', '-style', '-color'],
		'border-left': ['-width', '-style', '-color'],
		'border-radius': ['border-top-left-radius', 'border-top-right-radius', 'border-bottom-right-radius', 'border-bottom-left-radius'],
		'border-image': ['-source', '-slice', '-width', '-outset', '-repeat'],

		'font': ['-style', '-variant', '-weight', '-stretch', '-size', 'line-height', '-family'],
		'font-variant': ['-ligatures', '-alternates', '-caps', '-numeric', '-east-asian'],

		'mask': ['-image', '-mode', '-position', '-size', '-repeat', '-origin', '-clip'],
		'mask-border': ['-source', '-slice', '-width', '-outset', '-repeat', '-mode'],

		'columns': ['column-width', 'column-count'],
		'column-rule': ['-width', '-style', '-color'],

		'cue': ['-before', '-after'],
		'pause': ['-before', '-after'],
		'rest': ['-before', '-after'],

		'text-decoration': ['-line', '-style', '-color'],
		'text-emphasis': ['-style', '-color'],

		'animation': ['-name', '-duration', '-timing-function', '-delay', '-iteration-count', '-direction', '-fill-mode', '-play-state'],

		'transition': ['-property', '-duration', '-timing-function', '-delay'],

		'flex': ['-grow', '-shrink', '-basis'],

		'grid': ['-template', '-auto-flow', '-auto-rows', '-auto-columns'],
		'grid-template': ['-rows', '-columns', '-areas'],

		'overflow': ['-x', '-y', '-style'] };

	var expandCache = Object.create(null);
	var unexpandCache = Object.create(null);

	this.expand = function (property) {
		var _this = this;

		var result = expandCache[property];
		if (result) {
			return result;
		}

		var prefixData = property.match(/^(-[a-zA-Z]+-)?(.*)$/);
		var prefix = prefixData[1] || '',
		    prefixFreeProperty = prefixData[2] || '';
		if (!shorthands.hasOwnProperty(prefixFreeProperty)) {
			return [];
		}

		result = [];
		shorthands[prefixFreeProperty].forEach(function (p) {
			var longhand = p[0] === '-' ? property + p : prefix + p;
			result.push(longhand);
			result.push.apply(result, _this.expand(longhand));
		});

		return expandCache[property] = result;
	};

	this.unexpand = function unexpand(property) {

		var result = unexpandCache[property];
		if (result) {
			return result;
		}

		var prefixData = property.match(/^(-[a-zA-Z]+-)?(.*)$/);
		var prefix = prefixData[1] || '',
		    prefixFreeProperty = prefixData[2] || '';

		result = [];
		for (var sh = 0; sh <= shorthands.length; sh++) {
			var shorthand = shorthands[sh];
			if (this.expand(shorthand).indexOf(prefixFreeProperty) >= 0) {
				result.push(prefix + shorthand);
				result.push.apply(result, this.unexpand(prefix + shorthand));
			}
		}

		return unexpandCache[property] = result;
	};
}.call(window.CSSShorthands = {});

var hasBluePrintUsage = function hasBluePrintUsage() {

	if (!document.querySelector(".container")) {
		return false;
	}

	for (var i = 24 + 1; --i;) {
		if (document.querySelector(".container > .span-" + i)) {
			return true;
		}
	}
	return false;
};


var detectedBootstrapGridUsages = function detectedBootstrapGridUsages(domClasses) {
	var _ = window.CSSUsageLodash;
	var reduce = _.reduce.bind(_);
	var trackedClasses = [];

	var sizes = ['xs', 'sm', 'md', 'lg'];
	for (var i = sizes.length; i--;) {
		var size = sizes[i];
		for (var j = 12 + 1; --j;) {
			trackedClasses.push('col-' + size + '-' + j);
			for (var k = 12 + 1; --k;) {
				trackedClasses.push('col-' + size + '-' + j + '-offset-' + k);
				trackedClasses.push('col-' + size + '-' + j + '-push-' + k);
				trackedClasses.push('col-' + size + '-' + j + '-pull-' + k);
			}
		}
	}

	return reduce(trackedClasses, function (a, b) {
		return a + (domClasses[b] | 0);
	}, 0);
};

var detectedBootstrapFormUsages = function detectedBootstrapFormUsages(domClasses) {
	var _ = window.CSSUsageLodash;
	var reduce = _.reduce.bind(_);
	var trackedClasses = ['form-group', 'form-group-xs', 'form-group-sm', 'form-group-md', 'form-group-lg', 'form-control', 'form-horizontal', 'form-inline', 'btn', 'btn-primary', 'btn-secondary', 'btn-success', 'btn-warning', 'btn-danger', 'btn-error'];

	return reduce(trackedClasses, function (a, b) {
		return a + (domClasses[b] | 0);
	}, 0);
};

var detectedBootstrapAlertUsages = function detectedBootstrapAlertUsages(domClasses) {
	var _ = window.CSSUsageLodash;
	var reduce = _.reduce.bind(_);
	var trackedClasses = ['alert', 'alert-primary', 'alert-secondary', 'alert-success', 'alert-warning', 'alert-danger', 'alert-error'];

	return reduce(trackedClasses, function (a, b) {
		return a + (domClasses[b] | 0);
	}, 0);
};

var detectedBootstrapFloatUsages = function detectedBootstrapFloatUsages(domClasses) {
	var _ = window.CSSUsageLodash;
	var reduce = _.reduce.bind(_);
	var trackedClasses = ['pull-left', 'pull-right'];

	return reduce(trackedClasses, function (a, b) {
		return a + (domClasses[b] | 0);
	}, 0);
};

var hasDogfaloMaterializeUsage = function hasDogfaloMaterializeUsage() {

	if (!document.querySelector(".container > .row > .col")) {
		return false;
	}

	for (var i = 12 + 1; --i;) {
		var classesToLookUp = ['s', 'm', 'l'];
		for (var d = 0; d < classesToLookUp.length; d++) {
			var s = classesToLookUp[d];
			if (document.querySelector(".container > .row > .col." + s + "" + i)) {
				return true;
			}
		}
	}
	return false;
};

var hasGrumbyUsage = function hasGrumbyUsage() {

	if (!document.querySelector(".row .columns")) {
		return false;
	}

	var classesToLookUp = ["one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve"];
	for (var cl = 0; cl < classesToLookUp.length; cl++) {
		var fraction = classesToLookUp[cl];
		if (document.querySelector(".row > .columns." + fraction)) {
			return true;
		}
	}
	return false;
};

var hasInuitUsage = function hasInuitUsage() {

	if (!document.querySelector(".grid .grid__item")) {
		return false;
	}

	var classesToLookUp = ["one-whole", "one-half", "one-third", "two-thirds", "one-quarter", "two-quarters", "one-half", "three-quarters", "one-fifth", "two-fifths", "three-fifths", "four-fifths", "one-sixth", "two-sixths", "one-third", "three-sixths", "one-half", "four-sixths", "two-thirds", "five-sixths", "one-eighth", "two-eighths", "one-quarter", "three-eighths", "four-eighths", "one-half", "five-eighths", "six-eighths", "three-quarters", "seven-eighths", "one-tenth", "two-tenths", "one-fifth", "three-tenths", "four-tenths", "two-fifths", "five-tenths", "one-half", "six-tenths", "three-fifths", "seven-tenths", "eight-tenths", "four-fifths", "nine-tenths", "one-twelfth", "two-twelfths", "one-sixth", "three-twelfths", "one-quarter", "four-twelfths", "one-third", "five-twelfths", "six-twelfths", "one-half", "seven-twelfths", "eight-twelfths", "two-thirds", "nine-twelfths", "three-quarters", "ten-twelfths", "five-sixths", "eleven-twelfths"];

	for (var cu = 0; cu < classesToLookUp.length; cu++) {
		var fraction = classesToLookUp[cu];

		var subClassesToLookUp = ["", "palm-", "lap-", "portable-", "desk-"];
		for (var sc = 0; sc < subClassesToLookUp.length; sc++) {
			var ns = subClassesToLookUp[sc];
			if (document.querySelector(".grid > .grid__item." + ns + fraction)) {
				return true;
			}
		}
	}
	return false;
};
var getLonelyGatesUsage = function getLonelyGatesUsage(cssLonelyClassGates, domClasses, domIds, cssLonelyIdGates) {

	var _ = window.CSSUsageLodash;

	if ((cssLonelyClassGates || domClasses || domIds || cssLonelyIdGates) == undefined) return;

	var cssUniqueLonelyClassGatesArray = Object.keys(cssLonelyClassGates);
	var cssUniqueLonelyClassGatesUsedArray = _(cssUniqueLonelyClassGatesArray).filter(function (c) {
		return domClasses[c];
	}).value();
	var cssUniqueLonelyClassGatesUsedWorthArray = _(cssUniqueLonelyClassGatesUsedArray).filter(function (c) {
		return cssLonelyClassGates[c] > 9;
	}).value();
	if (window.debugCSSUsage) console.log(cssLonelyClassGates);
	if (window.debugCSSUsage) console.log(cssUniqueLonelyClassGatesUsedWorthArray);

	var cssUniqueLonelyIdGatesArray = Object.keys(cssLonelyIdGates);
	var cssUniqueLonelyIdGatesUsedArray = _(cssUniqueLonelyIdGatesArray).filter(function (c) {
		return domIds[c];
	}).value();
	var cssUniqueLonelyIdGatesUsedWorthArray = _(cssUniqueLonelyIdGatesUsedArray).filter(function (c) {
		return cssLonelyIdGates[c] > 9;
	}).value();
	if (window.debugCSSUsage) console.log(cssLonelyIdGates);
	if (window.debugCSSUsage) console.log(cssUniqueLonelyIdGatesUsedWorthArray);
};

var detectedModernizerUsages = function detectedModernizerUsages(cssLonelyClassGates) {

	if (cssLonelyClassGates == undefined) return;

	var ModernizerUsages = { count: 0, values: {} };
	var trackedClasses = ["js", "ambientlight", "applicationcache", "audio", "batteryapi", "blobconstructor", "canvas", "canvastext", "contenteditable", "contextmenu", "cookies", "cors", "cryptography", "customprotocolhandler", "customevent", "dart", "dataview", "emoji", "eventlistener", "exiforientation", "flash", "fullscreen", "gamepads", "geolocation", "hashchange", "hiddenscroll", "history", "htmlimports", "ie8compat", "indexeddb", "indexeddbblob", "input", "search", "inputtypes", "intl", "json", "olreversed", "mathml", "notification", "pagevisibility", "performance", "pointerevents", "pointerlock", "postmessage", "proximity", "queryselector", "quotamanagement", "requestanimationframe", "serviceworker", "svg", "templatestrings", "touchevents", "typedarrays", "unicoderange", "unicode", "userdata", "vibrate", "video", "vml", "webintents", "animation", "webgl", "websockets", "xdomainrequest", "adownload", "audioloop", "audiopreload", "webaudio", "lowbattery", "canvasblending", "todataurljpeg,todataurlpng,todataurlwebp", "canvaswinding", "getrandomvalues", "cssall", "cssanimations", "appearance", "backdropfilter", "backgroundblendmode", "backgroundcliptext", "bgpositionshorthand", "bgpositionxy", "bgrepeatspace,bgrepeatround", "backgroundsize", "bgsizecover", "borderimage", "borderradius", "boxshadow", "boxsizing", "csscalc", "checked", "csschunit", "csscolumns", "cubicbezierrange", "display-runin", "displaytable", "ellipsis", "cssescape", "cssexunit", "cssfilters", "flexbox", "flexboxlegacy", "flexboxtweener", "flexwrap", "fontface", "generatedcontent", "cssgradients", "hsla", "csshyphens,softhyphens,softhyphensfind", "cssinvalid", "lastchild", "cssmask", "mediaqueries", "multiplebgs", "nthchild", "objectfit", "opacity", "overflowscrolling", "csspointerevents", "csspositionsticky", "csspseudoanimations", "csspseudotransitions", "cssreflections", "regions", "cssremunit", "cssresize", "rgba", "cssscrollbar", "shapes", "siblinggeneral", "subpixelfont", "supports", "target", "textalignlast", "textshadow", "csstransforms", "csstransforms3d", "preserve3d", "csstransitions", "userselect", "cssvalid", "cssvhunit", "cssvmaxunit", "cssvminunit", "cssvwunit", "willchange", "wrapflow", "classlist", "createelementattrs,createelement-attrs", "dataset", "documentfragment", "hidden", "microdata", "mutationobserver", "bdi", "datalistelem", "details", "outputelem", "picture", "progressbar,meter", "ruby", "template", "time", "texttrackapi,track", "unknownelements", "es5array", "es5date", "es5function", "es5object", "es5", "strictmode", "es5string", "es5syntax", "es5undefined", "es6array", "contains", "generators", "es6math", "es6number", "es6object", "promises", "es6string", "devicemotion,deviceorientation", "oninput", "filereader", "filesystem", "capture", "fileinput", "directory", "formattribute", "localizednumber", "placeholder", "requestautocomplete", "formvalidation", "sandbox", "seamless", "srcdoc", "apng", "jpeg2000", "jpegxr", "sizes", "srcset", "webpalpha", "webpanimation", "webplossless,webp-lossless", "webp", "inputformaction", "inputformenctype", "inputformmethod", "inputformtarget", "beacon", "lowbandwidth", "eventsource", "fetch", "xhrresponsetypearraybuffer", "xhrresponsetypeblob", "xhrresponsetypedocument", "xhrresponsetypejson", "xhrresponsetypetext", "xhrresponsetype", "xhr2", "scriptasync", "scriptdefer", "speechrecognition", "speechsynthesis", "localstorage", "sessionstorage", "websqldatabase", "stylescoped", "svgasimg", "svgclippaths", "svgfilters", "svgforeignobject", "inlinesvg", "smil", "textareamaxlength", "bloburls", "datauri", "urlparser", "videoautoplay", "videoloop", "videopreload", "webglextensions", "datachannel", "getusermedia", "peerconnection", "websocketsbinary", "atob-btoa", "framed", "matchmedia", "blobworkers", "dataworkers", "sharedworkers", "transferables", "webworkers"];
	for (var tc = 0; tc < trackedClasses.length; tc++) {
		var c = trackedClasses[tc];
		countInstancesOfTheClass(c);
		countInstancesOfTheClass('no-' + c);
	}
	return ModernizerUsages;

	function countInstancesOfTheClass(c) {
		var count = cssLonelyClassGates[c];if (!count) return;
		ModernizerUsages.count += count;
		ModernizerUsages.values[c] = count;
	}
};
function getFwkUsage(results, cssLonelyClassGates, domClasses, domIds, cssLonelyIdGates, cssClasses) {
	getLonelyGatesUsage(cssLonelyClassGates, domClasses, domIds, cssLonelyIdGates);
	detectedModernizerUsages(cssLonelyClassGates);
	results.FwkModernizer = !!window.Modernizer;
	results.FwkModernizerDOMUsages = detectedModernizerUsages(domClasses);
	results.FwkModernizerCSSUsages = detectedModernizerUsages(cssLonelyClassGates);

	results.FwkBootstrap = !!((window.jQuery || window.$) && (window.jQuery || window.$).fn && (window.jQuery || window.$).fn.modal) | 0;
	results.FwkBootstrapGridUsage = detectedBootstrapGridUsages(domClasses);
	results.FwkBootstrapFormUsage = detectedBootstrapFormUsages(domClasses);
	results.FwkBootstrapFloatUsage = detectedBootstrapFloatUsages(domClasses);
	results.FwkBootstrapAlertUsage = detectedBootstrapAlertUsages(domClasses);
	results.FwkBootstrapGridRecognized = detectedBootstrapGridUsages(cssClasses);
	results.FwkBootstrapFormRecognized = detectedBootstrapFormUsages(cssClasses);
	results.FwkBootstrapFloatRecognized = detectedBootstrapFloatUsages(cssClasses);
	results.FwkBootstrapAlertRecognized = detectedBootstrapAlertUsages(cssClasses);

	results.FwkGrumby = hasGrumbyUsage() | 0;

	results.FwkInuit = hasInuitUsage() | 0;

	results.FwkBluePrint = hasBluePrintUsage() | 0;

	results.FwkDogfaloMaterialize = hasDogfaloMaterializeUsage() | 0;

	return results;
}

var detectedClearfixUsages = function detectedClearfixUsages(domClasses) {

	var _ = window.CSSUsageLodash;
	var reduce = _.reduce.bind(_);

	var trackedClasses = ['clearfix', 'clear'];

	return reduce(trackedClasses, function (a, b) {
		return a + (domClasses[b] | 0);
	}, 0);
};

var detectedVisibilityUsages = function detectedVisibilityUsages(domClasses) {
	var _ = window.CSSUsageLodash;
	var reduce = _.reduce.bind(_);

	var trackedClasses = ['show', 'hide', 'visible', 'hidden'];

	return reduce(trackedClasses, function (a, b) {
		return a + (domClasses[b] | 0);
	}, 0);
};
function getPatternUsage(results, domClasses, cssClasses) {
	results.PatClearfixUsage = detectedClearfixUsages(domClasses);
	results.PatVisibilityUsage = detectedVisibilityUsages(domClasses);
	results.PatClearfixRecognized = detectedClearfixUsages(cssClasses);
	results.PatVisibilityRecognized = detectedVisibilityUsages(cssClasses);

	return results;
}
void function () {

	window.HtmlUsage = {};

	window.HtmlUsage.GetNodeName = function (element) {
		if (element instanceof HTMLUnknownElement) {
			return;
		}

		var node = element.nodeName;

		var tags = HtmlUsageResults.tags || (HtmlUsageResults.tags = {});
		var tag = tags[node] || (tags[node] = 0);
		tags[node]++;

		GetAttributes(element, node);
	};

	function GetAttributes(element, node) {
		for (var i = 0; i < element.attributes.length; i++) {
			var att = element.attributes[i];

			if (IsValidAttribute(element, att.nodeName)) {
				var attributes = HtmlUsageResults.attributes || (HtmlUsageResults.attributes = {});
				var attribute = attributes[att.nodeName] || (attributes[att.nodeName] = {});
				var attributeTag = attribute[node] || (attribute[node] = { count: 0 });
				attributeTag.count++;
			}
		}
	}

	function IsValidAttribute(element, attname) {
		if (attname == "class") {
			attname = "className";
		}

		if (attname == "classname") {
			return false;
		}

		if (attname.indexOf('data-') != -1) {
			return false;
		}

		if (typeof element[attname] == "undefined") {
			return false;
		}

		return true;
	}
}();
void function () {
	try {

		var _ = window.CSSUsageLodash;
		var map = _.map.bind(_);
		var mapInline = _.mapInline ? _.mapInline : map;
		var reduce = _.reduce.bind(_);
		var filter = _.filter.bind(_);

		var browserIsEdge = navigator.userAgent.indexOf('Edge') >= 0;
		var browserIsFirefox = navigator.userAgent.indexOf('Firefox') >= 0;

		void function () {
			if (top.location.href !== location.href) throw new Error("CSSUsage: the script doesn't run in frames for now");

			if (window.CSSUsage) throw new Error("CSSUsage: second execution attempted; only one run can be executed; if you specified parameters, check the right ones were chosen");

			if (!window.CSSUsageLodash) throw new Error("CSSUsage: missing CSSUsageLodash dependency");

			if (!window.HtmlUsage) throw new Error("APIUsage: missing HtmlUsage dependancy");

			if (('' + String.prototype.trim).indexOf("[native code]") == -1) {
				console.warn('Replaced custom trim function with something known to work. Might break website.');
				String.prototype.trim = function () {
					return this.replace(/^\s+|\s+$/g, '');
				};
			}
		}();

		void function () {
			window.HtmlUsageResults = {
				tags: {},
				attributes: {} };

			window.RecipeResults = {};
			window.Recipes = {
				recipes: []
			};

			window.CSSUsage = {};
			window.CSSUsageResults = {
				types: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
				props: Object.create(null),
				usages: { "SuccessfulCrawls": 1 },

				rules: { "@stylerule": 0, "@atrule": 0, "@inline": 0 } };
		}();

		void function () {
			"use strict";

			CSSUsage.StyleWalker = {
				ruleAnalyzers: [],

				elementAnalyzers: [],

				recipesToRun: [],
				runRecipes: false,

				walkOverCssStyles: walkOverCssStyles,
				walkOverDomElements: walkOverDomElements,

				amountOfInlineStyles: 0,
				amountOfSelectorsUnused: 0,
				amountOfSelectors: 0
			};

			var hasWalkedDomElementsOnce = false;

			var keyframes = Object.create(null);

			function walkOverCssStyles() {
				var styleSheets = document.styleSheets;

				for (var ssIndex = styleSheets.length; ssIndex--;) {
					var styleSheet = styleSheets[ssIndex];
					try {
						if (styleSheet.cssRules) {
							walkOverCssRules(styleSheet.cssRules, styleSheet);
						} else {
							console.warn("No content loaded for stylesheet: ", styleSheet.href || styleSheet);
						}
					} catch (e) {
						console.log(e, e.stack);
					}
				}

				var animations = (CSSUsageResults.props['animation-name'] || {}).values || {};
				for (var animation in keyframes) {
					var keyframe = keyframes[animation];
					var matchCount = animations[animation] | 0;
					var fakeElements = initArray(matchCount, function (i) {
						return { tagName: '@keyframes ' + animation + ' [' + i + ']' };
					});
					processRule(keyframe, fakeElements);
				}
			}

			function walkOverCssRules(cssRules, styleSheet, parentMatchedElements) {
				for (var ruleIndex = cssRules.length; ruleIndex--;) {
					var rule = cssRules[ruleIndex];

					if (rule.type == 7) {
						keyframes[rule.name] = rule;
						continue;
					}

					if (rule.type == 12 && (!CSS.supports || !CSS.supports(rule.conditionText))) {
						continue;
					}

					processRule(rule, parentMatchedElements);
				}
			}

			function processRule(rule, parentMatchedElements) {
				CSSUsageResults.types[rule.type | 0]++;

				if (rule.cssRules && rule.cssRules.length > 0) {

					walkOverCssRules(rule.cssRules, rule.parentStyleSheet, parentMatchedElements);
				}

				if (rule.style) {
					var selectorText;
					var matchedElements;
					if (rule.selectorText) {
						selectorText = CSSUsage.PropertyValuesAnalyzer.cleanSelectorText(rule.selectorText);
						try {
							if (parentMatchedElements) {
								matchedElements = [].slice.call(document.querySelectorAll(selectorText));
								matchedElements.parentMatchedElements = parentMatchedElements;
							} else {
								matchedElements = [].slice.call(document.querySelectorAll(selectorText));
							}
						} catch (ex) {
							matchedElements = [];
							console.warn(ex.stack || "Invalid selector: " + selectorText + " -- via " + rule.selectorText);
						}
					} else {
						selectorText = '@atrule:' + rule.type;
						if (parentMatchedElements) {
							matchedElements = parentMatchedElements;
						} else {
							matchedElements = [];
						}
					}

					runRuleAnalyzers(rule.style, selectorText, matchedElements, rule.type);
				}
			}

			function walkOverDomElements(obj, index) {
				var recipesToRun = CSSUsage.StyleWalker.recipesToRun;
				obj = obj || document.documentElement;index = index | 0;

				var elements = [].slice.call(document.all, 0);
				for (var i = 0; i < elements.length; i++) {
					var element = elements[i];

					if (!CSSUsage.StyleWalker.runRecipes) {
						runElementAnalyzers(element, index);

						if (element.hasAttribute('style')) {
							var ruleType = 1;
							var isInline = true;
							var selectorText = '@inline:' + element.tagName;
							var matchedElements = [element];
							runRuleAnalyzers(element.style, selectorText, matchedElements, ruleType, isInline);
						}
					} else {
						for (var r = 0; r < recipesToRun.length; r++) {
							var recipeToRun = recipesToRun[r];
							var results = RecipeResults[recipeToRun.name] || (RecipeResults[recipeToRun.name] = {});
							recipeToRun(element, results, true);
						}
					}
				}
			}

			function runRuleAnalyzers(style, selectorText, matchedElements, type, isInline) {
				if (isInline) {
					CSSUsage.StyleWalker.amountOfInlineStyles++;
				} else {
					CSSUsage.StyleWalker.amountOfSelectors++;
				}

				for (var i = 0; i < CSSUsage.StyleWalker.ruleAnalyzers.length; i++) {
					var runAnalyzer = CSSUsage.StyleWalker.ruleAnalyzers[i];
					runAnalyzer(style, selectorText, matchedElements, type, isInline);
				}
			}

			function runElementAnalyzers(element, index, depth) {
				for (var i = 0; i < CSSUsage.StyleWalker.elementAnalyzers.length; i++) {
					var runAnalyzer = CSSUsage.StyleWalker.elementAnalyzers[i];
					runAnalyzer(element, index, depth);
				}
			}

			function initArray(length, initializer) {
				var array = Array(length);
				for (var i = length; i--;) {
					array[i] = initializer(i);
				}
				return array;
			}
		}();

		void function () {

			CSSUsage.CSSValues = {
				createValueArray: createValueArray,
				parseValues: parseValues,
				normalizeValue: createValueArray
			};

			function parseValues(value, propertyName) {
				value = value.trim();

				value = value.toLowerCase();

				if (isKeywordColor(value)) {
					return "<color-keyword>";
				}
				value = value.replace(/[#][0-9a-fA-F]+/g, '#xxyyzz');

				var numbers = ['ZERO', 'ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT', 'NINE'];
				value = value.replace(/([_a-z][-_a-z]|[_a-df-z])[0-9]+[-_a-z0-9]*/g, function (s) {
					return numbers.reduce(function (m, nstr, nint) {
						return m.replace(RegExp(nint, 'g'), nstr);
					}, s);
				});

				value = value.replace(/(?:[+]|[-]|)(?:(?:[0-9]+)(?:[.][0-9]+|)|(?:[.][0-9]+))(?:[e](?:[+]|[-]|)(?:[0-9]+))?(%|e[a-z]+|[a-df-z][a-z]*)/g, "$1");
				value = value.replace(/(?:[+]|[-]|)(?:[0-9]+)(?:[.][0-9]+)(?:[e](?:[+]|[-]|)(?:[0-9]+))?/g, " <float> ");
				value = value.replace(/(?:[+]|[-]|)(?:[.][0-9]+)(?:[e](?:[+]|[-]|)(?:[0-9]+))?/g, " <float> ");
				value = value.replace(/(?:[+]|[-]|)(?:[0-9]+)(?:[e](?:[+]|[-]|)(?:[0-9]+))/g, " <float> ");
				value = value.replace(/(?:[+]|[-]|)(?:[0-9]+)/g, " <int> ");

				value = numbers.reduce(function (m, nstr, nint) {
					return m.replace(RegExp(nstr, 'g'), nint);
				}, value);

				value = value.replace(/('|‘|’|")/g, "");

				switch (propertyName) {
					case 'counter-increment':
					case 'counter-reset':
						value = value.replace(/[-_a-zA-Z0-9]+/g, ' <custom-ident> ');
						break;

					case 'grid':
					case 'grid-template':
					case 'grid-template-rows':
					case 'grid-template-columns':
					case 'grid-template-areas':
						value = value.replace(/\[[-_a-zA-Z0-9 ]+\]/g, ' <line-names> ');
						break;

					case '--var':
						value = value.replace(/[(](?:[^()]+|[(](?:[^()]+|[(](?:[^()]+|[(](?:[^()]+|[(](?:[^()]*)[)])*[)])*[)])*[)])*[)]/g, " <parentheses-block> ");
						value = value.replace(/[(](?:[^()]+|[(](?:[^()]+|[(](?:[^()]+|[(](?:[^()]+|[(](?:[^()]*)[)])*[)])*[)])*[)])*[)]/g, " <parentheses-block> ");
						value = value.replace(/\[(?:[^()]+|\[(?:[^()]+|\[(?:[^()]+|\[(?:[^()]+|\[(?:[^()]*)\])*\])*\])*\])*\]/g, " <curly-brackets-block> ");
						value = value.replace(/\[(?:[^()]+|\[(?:[^()]+|\[(?:[^()]+|\[(?:[^()]+|\[(?:[^()]*)\])*\])*\])*\])*\]/g, " <curly-brackets-block> ");
						value = value.replace(/\{(?:[^()]+|\{(?:[^()]+|\{(?:[^()]+|\{(?:[^()]+|\{(?:[^()]*)\})*\})*\})*\})*\}/g, " <square-brackets-block> ");
						value = value.replace(/\{(?:[^()]+|\{(?:[^()]+|\{(?:[^()]+|\{(?:[^()]+|\{(?:[^()]*)\})*\})*\})*\})*\}/g, " <square-brackets-block> ");
						break;

				}

				return value.trim();
			}

			function createValueArray(value, propertyName) {
				value = value.trim();

				value = value.toLowerCase();

				value = value.replace(/([/][*](?:.|\r|\n)*[*][/]|[!]important.*)/g, '');

				switch (propertyName) {
					case 'font-family':
						if (value.indexOf("'") != -1 || value.indexOf("‘") != -1 || value.indexOf('"')) {
							value = value.replace(/('|‘|’|")/g, "");
						}

						value = value.split(/\s*,\s*/g);
						return value;

					case '--var':
						value = value.replace(/"([^"\\]|\\[^"\\]|\\\\|\\")*"/g, ' <string> ');
						value = value.replace(/'([^'\\]|\\[^'\\]|\\\\|\\')*'/g, ' <string> ');

						value = value.replace(/([a-z]?)[(](?:[^()]+|[(](?:[^()]+|[(](?:[^()]+|[(](?:[^()]+|[(](?:[^()]*)[)])*[)])*[)])*[)])*[)]/g, "$1()");
						value = value.replace(/([a-z]?)[(](?:[^()]+|[(](?:[^()]+|[(](?:[^()]+|[(](?:[^()]+|[(](?:[^()]*)[)])*[)])*[)])*[)])*[)]/g, "$1()");

						value = value.replace(/[(](?:[^()]+|[(](?:[^()]+|[(](?:[^()]+|[(](?:[^()]+|[(](?:[^()]*)[)])*[)])*[)])*[)])*[)]/g, " <parentheses-block> ");
						value = value.replace(/[(](?:[^()]+|[(](?:[^()]+|[(](?:[^()]+|[(](?:[^()]+|[(](?:[^()]*)[)])*[)])*[)])*[)])*[)]/g, " <parentheses-block> ");
						value = value.replace(/[{](?:[^{}]+|[{](?:[^{}]+|[{](?:[^{}]+|[{](?:[^{}]+|[{](?:[^{}]*)[}])*[}])*[}])*[}])*[}]/g, " <curly-brackets-block> ");
						value = value.replace(/[{](?:[^{}]+|[{](?:[^{}]+|[{](?:[^{}]+|[{](?:[^{}]+|[{](?:[^{}]*)[}])*[}])*[}])*[}])*[}]/g, " <curly-brackets-block> ");
						value = value.replace(/[\[](?:[^\[\]]+|[\[](?:[^\[\]]+|[\[](?:[^\[\]]+|[\[](?:[^\[\]]+|[\[](?:[^\[\]]*)[\]])*[\]])*[\]])*[\]])*[\]]/g, " <square-brackets-block> ");
						value = value.replace(/[\[](?:[^\[\]]+|[\[](?:[^\[\]]+|[\[](?:[^\[\]]+|[\[](?:[^\[\]]+|[\[](?:[^\[\]]*)[\]])*[\]])*[\]])*[\]])*[\]]/g, " <square-brackets-block> ");

						break;

					default:
						value = value.replace(/"([^"\\]|\\[^"\\]|\\\\|\\")*"/g, ' <string> ').replace(/'([^'\\]|\\[^'\\]|\\\\|\\')*'/g, ' <string> ');

						if (value.indexOf("(") != -1) {
							value = value.replace(/([a-z]?)[(](?:[^()]+|[(](?:[^()]+|[(](?:[^()]+|[(](?:[^()]+|[(](?:[^()]*)[)])*[)])*[)])*[)])*[)]/g, "$1() ");
							value = value.replace(/([a-z]?)[(](?:[^()]+|[(](?:[^()]+|[(](?:[^()]+|[(](?:[^()]+|[(](?:[^()]*)[)])*[)])*[)])*[)])*[)]/g, "$1() ");
						}

				}

				value = value.trim().replace(/\s+/g, " ");

				value = value.split(/\s*(?:,|[/])\s*|\s+/g);

				return value;
			}

			function isKeywordColor(candidateColor) {
				var isColorKeyword = /^(aliceblue|antiquewhite|aqua|aquamarine|azure|beige|bisque|black|blanchedalmond|blue|blueviolet|brown|burlywood|cadetblue|chartreuse|chocolate|coral|cornflowerblue|cornsilk|crimson|cyan|darkblue|darkcyan|darkgoldenrod|darkgray|darkgrey|darkgreen|darkkhaki|darkmagenta|darkolivegreen|darkorange|darkorchid|darkred|darksalmon|darkseagreen|darkslateblue|darkslategray|darkslategrey|darkturquoise|darkviolet|deeppink|deepskyblue|dimgray|dimgrey|dodgerblue|firebrick|floralwhite|forestgreen|fuchsia|gainsboro|ghostwhite|gold|goldenrod|gray|grey|green|greenyellow|honeydew|hotpink|indianred|indigo|ivory|khaki|lavender|lavenderblush|lawngreen|lemonchiffon|lightblue|lightcoral|lightcyan|lightgoldenrodyellow|lightgreen|lightgray|lightgrey|lightpink|lightsalmon|lightseagreen|lightskyblue|lightslategray|lighslategrey|lightsteelblue|lightyellow|lime|limegreen|linen|magenta|maroon|mediumaquamarine|mediumblue|mediumorchid|mediumpurple|mediumseagreen|mediumslateblue|mediumspringgreen|mediumturquoise|mediumvioletred|midnightblue|mintcream|mistyrose|moccasin|navajowhite|navy|navyblue|oldlace|olive|olivedrab|orange|orangered|orchid|palegoldenrod|palegreen|paleturquoise|palevioletred|papayawhip|peachpuff|peru|pink|plum|powderblue|purple|rebeccapurple|red|rosybrown|royalblue|saddlebrown|salmon|sandybrown|seagreen|seashell|sienna|silver|skyblue|slateblue|slategray|slategrey|snow|springgreen|steelblue|tan|teal|thistle|tomato|turquoise|violet|wheat|white|whitesmoke|yellow|yellowgreen)$/;
				return isColorKeyword.test(candidateColor);
			}
		}();

		void function () {

			CSSUsage.PropertyValuesAnalyzer = analyzeStyleOfRule;
			CSSUsage.PropertyValuesAnalyzer.cleanSelectorText = cleanSelectorText;
			CSSUsage.PropertyValuesAnalyzer.generalizedSelectorsOf = generalizedSelectorsOf;
			CSSUsage.PropertyValuesAnalyzer.finalize = finalize;

			var defaultStyle = getComputedStyle(document.createElement('div'));

			var getBuggyValuesForThisBrowser = function getBuggyValuesForThisBrowser() {
				var buggyValues = getBuggyValuesForThisBrowser.cache;
				if (buggyValues) {
					return buggyValues;
				} else {
					buggyValues = Object.create(null);
				}

				if (browserIsEdge) {

					buggyValues['*'] = 1;
					buggyValues['list-style-image:none'] = 1;

					buggyValues['border-top-color:currentcolor'] = 1;
					buggyValues['border-right-color:currentcolor'] = 1;
					buggyValues['border-bottom-color:currentcolor'] = 1;
					buggyValues['border-left-color:currentcolor'] = 1;

					buggyValues['border-top-width:medium'] = 1;
					buggyValues['border-right-width:medium'] = 1;
					buggyValues['border-bottom-width:medium'] = 1;
					buggyValues['border-left-width:medium'] = 1;
					buggyValues['border-image-source:none'] = 1;
					buggyValues['border-image-outset:0'] = 1;
					buggyValues['border-image-width:1'] = 1;
					buggyValues['border-image-repeat:repeat'] = 1;
					buggyValues['border-image-repeat-x:repeat'] = 1;
					buggyValues['border-image-repeat-y:repeat'] = 1;
					buggyValues['line-height:normal'] = 1;

					buggyValues['font-stretch:normal'] = 1;
				}

				if (browserIsFirefox) {

					buggyValues['*'] = 1;
				}

				Object.create(buggyValues);

				return getBuggyValuesForThisBrowser.cache = buggyValues;
			};
			var valueExistsInRootProperty = function valueExistsInRootProperty(cssText, key, rootKey, value) {
				value = value.trim().toLowerCase();

				var buggyValues = getBuggyValuesForThisBrowser();

				var buggyState = buggyValues[key + ':' + value];
				if (buggyState === 1) {
					return false;
				}
				if (buggyState !== 0 && (!buggyValues['*'] || CSSShorthands.unexpand(key).length == 0)) {
					return true;
				}

				if (key == rootKey) return false;

				var values = value.split(/\s+|\s*,\s*/g);
				var validValues = ' ';
				var validValuesExtractor = new RegExp(' ' + rootKey + '(?:[-][-_a-zA-Z0-9]+)?[:]([^;]*)', 'gi');
				var match;while (match = validValuesExtractor.exec(cssText)) {
					validValues += match[1] + ' ';
				}
				for (var i = 0; i < values.length; i++) {
					var value = values[i];
					if (validValues.indexOf(' ' + value + ' ') == -1) return false;
				}
				return true;
			};

			function analyzeStyleOfRule(style, selectorText, matchedElements, type, isInline) {
				isInline = !!isInline;

				var count = matchedElements.length;
				var selector = selectorText;
				var selectorCat = { '1:true': '@inline', '1:false': '@stylerule' }['' + type + ':' + isInline] || '@atrule';

				var isRuleUnused = count == 0;
				if (isRuleUnused) {
					CSSUsage.StyleWalker.amountOfSelectorsUnused++;
				}

				var generalizedSelectors = selectorCat == '@stylerule' ? [selectorCat].concat(generalizedSelectorsOf(selector)) : [selectorCat, selector];

				var generalizedSelectorsData = map(generalizedSelectors, function (generalizedSelector) {
					return CSSUsageResults.rules[generalizedSelector] || (CSSUsageResults.rules[generalizedSelector] = { count: 0, props: Object.create(null) });
				});

				for (var i = 0; i < generalizedSelectorsData.length; i++) {
					var generalizedSelectorData = generalizedSelectorsData[i];
					generalizedSelectorData.count++;
				}

				var cssText = ' ' + style.cssText.toLowerCase();
				if (browserIsEdge) {
					cssText = cssText.replace(/border: medium; border-image: none;/, 'border: none;');
					cssText = cssText.replace(/ border-image: none;/, ' ');
				}

				for (var i = style.length; i--;) {

					var key = style[i],
					    rootKeyIndex = key.indexOf('-'),
					    rootKey = rootKeyIndex == -1 ? key : key.substr(0, rootKeyIndex);
					var normalizedKey = rootKeyIndex == 0 && key.indexOf('-', 1) == 1 ? '--var' : key;
					var styleValue = style.getPropertyValue(key);

					var isValueInvalid = typeof styleValue !== 'string' && styleValue != "" && styleValue != undefined;
					if (isValueInvalid) {
						continue;
					}

					var isPropertyUndefined = cssText.indexOf(' ' + key + ':') == -1 && (styleValue == 'initial' || !valueExistsInRootProperty(cssText, key, rootKey, styleValue));
					if (isPropertyUndefined) {
						continue;
					}

					var specifiedValuesArray = CSSUsage.CSSValues.createValueArray(styleValue, normalizedKey);
					var values = new Array();
					for (var j = specifiedValuesArray.length; j--;) {
						values.push(CSSUsage.CSSValues.parseValues(specifiedValuesArray[j], normalizedKey));
					}

					for (var gs = 0; gs < generalizedSelectorsData.length; gs++) {
						var generalizedSelectorData = generalizedSelectorsData[gs];

						var propStats = generalizedSelectorData.props[normalizedKey] || (generalizedSelectorData.props[normalizedKey] = { count: 0, values: Object.create(null) });

						propStats.count++;

						for (var v = 0; v < values.length; v++) {
							var value = values[v];

							if (value.length > 0) {
								propStats.values[value] = (propStats.values[value] | 0) + 1;
							}
						}
					}

					if (count > 0) {
						var propObject = CSSUsageResults.props[normalizedKey];
						if (!propObject) {
							propObject = CSSUsageResults.props[normalizedKey] = {
								count: 0,
								values: Object.create(null)
							};
						}

						for (var e = 0; e < matchedElements.length; e++) {
							var element = matchedElements[e];

							var cssUsageMeta = element.CSSUsage || (element.CSSUsage = Object.create(null));
							var knownValues = cssUsageMeta[normalizedKey] || (cssUsageMeta[normalizedKey] = []);

							knownValues.valuesArray = knownValues.valuesArray || (knownValues.valuesArray = []);

							for (var sv = 0; sv < specifiedValuesArray.length; sv++) {
								var currentSV = specifiedValuesArray[sv];
								if (knownValues.valuesArray.indexOf(currentSV) == -1) {
									knownValues.valuesArray.push(currentSV);
								}
							}

							if (knownValues.length == 0) {
								propObject.count += 1;
							}

							for (var v = 0; v < values.length; v++) {
								var value = values[v];
								if (knownValues.indexOf(value) >= 0) {
									return;
								}
								propObject.values[value] = (propObject.values[value] | 0) + 1;
								knownValues.push(value);
							}
						}
					}
				}
			}

			function finalize() {
				function removeAnimationNames() {
					if (CSSUsageResults.props["animation-name"]) {
						CSSUsageResults.props["animation-name"].values = { "<custom-ident>": CSSUsageResults.props["animation-name"].count };
					}

					for (var selector in CSSUsageResults.rules) {
						var rule = CSSUsageResults.rules[selector];
						if (rule && rule.props && rule.props["animation-name"]) {
							rule.props["animation-name"].values = { "<custom-ident>": rule.props["animation-name"].count };
						}
					}
				}

				removeAnimationNames();
			}

			function cleanSelectorText(text) {
				if (text.indexOf(':') == -1) {
					return text;
				} else {
					return text.replace(/([-_a-zA-Z0-9*\[\]]?):(?:hover|active|focus|before|after|not\(:(hover|active|focus)\))|::(?:before|after)/gi, '>>$1<<').replace(/(^| |>|\+|~)>><</g, '$1*').replace(/\(>><<\)/g, '(*)').replace(/>>([-_a-zA-Z0-9*\[\]]?)<</g, '$1');
				}
			}

			function generalizedSelectorsOf(value) {
				value = value.trim();

				if (value) {
					value = value.replace(/\s+/g, " ");
				}

				if (value.indexOf("(") != -1) {
					value = value.replace(/[(](?:[^()]+|[(](?:[^()]+|[(](?:[^()]+|[(](?:[^()]+|[(](?:[^()]*)[)])*[)])*[)])*[)])*[)]/g, "");
					value = value.replace(/[(](?:[^()]+|[(](?:[^()]+|[(](?:[^()]+|[(](?:[^()]+|[(](?:[^()]*)[)])*[)])*[)])*[)])*[)]/g, "");
				}

				value = value.replace(/"([^"\\]|\\[^"\\]|\\\\|\\")*"/g, '""');
				value = value.replace(/'([^'\\]|\\[^'\\]|\\\\|\\')*'/g, "''");

				if (value.indexOf("[") != -1) {
					value = value.replace(/\[[^=\[\]]+="([^"\\]|\\[^"\\]|\\\\|\\")*"\]/g, "[a]");
					value = value.replace(/\[[^=\[\]]+='([^'\\]|\\[^'\\]|\\\\|\\')*'\]/g, "[a]");
					value = value.replace(/\[[^\[\]]+\]/g, "[a]");
				}

				if (value.indexOf(".") != -1) {
					value = value.replace(/[.][-_a-zA-Z][-_a-zA-Z0-9]*/g, ".c");
				}

				if (value.indexOf("#") != -1) {
					value = value.replace(/[#][-_a-zA-Z][-_a-zA-Z0-9]*/g, "#i");
				}

				value = value.replace(/[ ]*([>|+|~])[ ]*/g, ' $1 ');

				value = value.trim();

				value = value.replace(/[*]([#.\x5B:])/g, '$1');

				value = sortSelectorComponents(value);

				value = value.split(/\s*,\s*/g);

				return value;
			}

			var ID_REGEXP = "[#]i";
			var CLASS_REGEXP = "[.]c";
			var ATTR_REGEXP = "\\[a\\]";
			var PSEUDO_REGEXP = "[:][:]?[-_a-zA-Z][-_a-zA-Z0-9]*";
			var SORT_REGEXPS = [new RegExp("(" + CLASS_REGEXP + ")(" + ID_REGEXP + ")", 'g'), new RegExp("(" + ATTR_REGEXP + ")(" + ID_REGEXP + ")", 'g'), new RegExp("(" + PSEUDO_REGEXP + ")(" + ID_REGEXP + ")", 'g'), new RegExp("(" + ATTR_REGEXP + ")(" + CLASS_REGEXP + ")", 'g'), new RegExp("(" + PSEUDO_REGEXP + ")(" + CLASS_REGEXP + ")", 'g'), new RegExp("(" + PSEUDO_REGEXP + ")(" + ATTR_REGEXP + ")", 'g')];
			function sortSelectorComponents(value) {

				var oldValue;do {

					oldValue = value;
					for (var i = 0; i < SORT_REGEXPS.length; i++) {
						var wrongPair = SORT_REGEXPS[i];
						value = value.replace(wrongPair, '$2$1');
					}
				} while (oldValue != value);return value;
			}
		}();

		void function () {
			var cssPseudos = Object.create(null);
			var domClasses = Object.create(null);
			var cssClasses = Object.create(null);
			var domIds = Object.create(null);
			var cssIds = Object.create(null);
			var cssLonelyIdGates = Object.create(null);
			var cssLonelyClassGates = Object.create(null);
			var cssLonelyClassGatesMatches = [];
			var cssLonelyIdGatesMatches = [];
			var ID_REGEXP = /[#][-_a-zA-Z][-_a-zA-Z0-9]*/g;
			var ID_REGEXP1 = /[#][-_a-zA-Z][-_a-zA-Z0-9]*/;
			var CLASS_REGEXP = /[.][-_a-zA-Z][-_a-zA-Z0-9]*/g;
			var CLASS_REGEXP1 = /[.][-_a-zA-Z][-_a-zA-Z0-9]*/;
			var PSEUDO_REGEXP = /[:][-_a-zA-Z][-_a-zA-Z0-9]*/g;
			var GATEID_REGEXP = /^\s*[#][-_a-zA-Z][-_a-zA-Z0-9]*([.][-_a-zA-Z][-_a-zA-Z0-9]*|[:][-_a-zA-Z][-_a-zA-Z0-9]*)*\s+[^>+{, ][^{,]+$/;
			var GATECLASS_REGEXP = /^\s*[.][-_a-zA-Z][-_a-zA-Z0-9]*([:][-_a-zA-Z][-_a-zA-Z0-9]*)*\s+[^>+{, ][^{,]+$/;
			function extractFeature(feature, selector, counters) {
				var instances = selector.match(feature) || [];
				for (var i = 0; i < instances.length; i++) {
					var instance = instances[i];
					instance = instance.substr(1);
					counters[instance] = (counters[instance] | 0) + 1;
				}
			}

			CSSUsage.SelectorAnalyzer = function parseSelector(style, selectorsText) {
				if (typeof selectorsText != 'string') return;

				var selectors = selectorsText.split(',');
				for (var i = selectors.length; i--;) {
					var selector = selectors[i];

					extractFeature(ID_REGEXP, selector, cssIds);
					extractFeature(CLASS_REGEXP, selector, cssClasses);
					extractFeature(PSEUDO_REGEXP, selector, cssPseudos);

					if (GATEID_REGEXP.test(selector)) {
						cssLonelyIdGatesMatches.push(selector);
						extractFeature(ID_REGEXP1, selector, cssLonelyIdGates);
					}
					if (GATECLASS_REGEXP.test(selector)) {
						cssLonelyClassGatesMatches.push(selector);
						extractFeature(CLASS_REGEXP1, selector, cssLonelyClassGates);
					}
				}
			};

			CSSUsage.DOMClassAnalyzer = function (element) {
				if (element.className) {
					var elementClasses = element.classList;
					for (var cl = 0; cl < elementClasses.length; cl++) {
						var c = elementClasses[cl];
						domClasses[c] = (domClasses[c] | 0) + 1;
					}
				}

				if (element.id) {
					domIds[element.id] = (domIds[element.id] | 0) + 1;
				}
			};

			CSSUsage.SelectorAnalyzer.finalize = function () {
				var domClassesArray = Object.keys(domClasses);
				var cssClassesArray = Object.keys(cssClasses);
				var domIdsArray = Object.keys(domIds);
				var cssIdsArray = Object.keys(cssIds);

				var results = {
					SuccessfulCrawls: 1,

					DOMElements: document.all.length,

					SelectorsFound: CSSUsage.StyleWalker.amountOfSelectors,
					InlineStylesFound: CSSUsage.StyleWalker.amountOfInlineStyles,
					SelectorsUnused: CSSUsage.StyleWalker.amountOfSelectorsUnused,

					IdsUsed: domIdsArray.length,
					IdsRecognized: Object.keys(cssIds).length,
					IdsUsedRecognized: filter(domIdsArray, function (i) {
						return cssIds[i];
					}).length,

					ClassesUsed: domClassesArray.length,
					ClassesRecognized: Object.keys(cssClasses).length,
					ClassesUsedRecognized: filter(domClassesArray, function (c) {
						return cssClasses[c];
					}).length
				};

				results = getFwkUsage(results, cssLonelyClassGates, domClasses, domIds, cssLonelyIdGates, cssClasses);
				results = getPatternUsage(results, domClasses, cssClasses);

				CSSUsageResults.usages = results;
				if (window.debugCSSUsage) console.log(CSSUsageResults.usages);
			};
		}();

		void function () {

			if (document.readyState !== 'complete') {
				window.addEventListener('load', onready);
				setTimeout(onready, 10000);
			} else {
				onready();
			}

			function onready() {
				var firstTime = !onready.hasAlreadyRun;onready.hasAlreadyRun = true;
				if (!firstTime) {
					return;
				}

				if (document.styleSheets.length == 0) {
					return;
				}

				if (document.styleSheets.length == 1 && browserIsFirefox) {
					if (document.styleSheets[0].href.indexOf('aboutNetError') != -1) {
						return;
					}
				}

				var startTime = performance.now();

				CSSUsage.StyleWalker.ruleAnalyzers.push(CSSUsage.PropertyValuesAnalyzer);
				CSSUsage.StyleWalker.ruleAnalyzers.push(CSSUsage.SelectorAnalyzer);
				CSSUsage.StyleWalker.elementAnalyzers.push(CSSUsage.DOMClassAnalyzer);
				CSSUsage.StyleWalker.elementAnalyzers.push(HtmlUsage.GetNodeName);

				CSSUsage.StyleWalker.walkOverDomElements();
				CSSUsage.StyleWalker.walkOverCssStyles();
				CSSUsage.PropertyValuesAnalyzer.finalize();
				CSSUsage.SelectorAnalyzer.finalize();

				CSSUsage.StyleWalker.runRecipes = true;
				CSSUsage.StyleWalker.walkOverDomElements();

				CSSUsageResults.duration = performance.now() - startTime | 0;

				if (window.debugCSSUsage) console.log(CSSUsageResults);
				if (window.onCSSUsageResults) {
					window.onCSSUsageResults(CSSUsageResults);
				};
			}
		}();
	} catch (ex) {
		throw ex;
	}
}();


void function () {
	window.CSSUsage.StyleWalker.recipesToRun.push(function metaviewport(element, results) {
		var needles = ["width", "height", "initial-scale", "minimum-scale", "maximum-scale", "user-scalable"];

		if (element.nodeName == "META") {
			for (var n = 0; n < element.attributes.length; n++) {
				if (element.attributes[n].name == "content") {

					for (var needle = 0; needle < needles.length; needle++) {
						var value = element.attributes[n].value;

						if (value.indexOf(needles[needle] != -1)) {
							results[value] = results[value] || { count: 0 };
							results[value].count++;
							break;
						}
					}
				}
			}
		}

		return results;
	});
}();


void function () {
	window.CSSUsage.StyleWalker.recipesToRun.push(function paddingHack(element, results) {
		if (!element.CSSUsage || !(element.CSSUsage["padding-bottom"] || element.CSSUsage["padding-top"])) return;

		var values = [];

		if (element.CSSUsage["padding-top"]) {
			values = values.concat(element.CSSUsage["padding-top"].valuesArray);
		}

		if (element.CSSUsage["padding-bottom"]) {
			values = values.concat(element.CSSUsage["padding-bottom"].valuesArray);
		}

		for (var i = 0; i < values.length; i++) {
			if (values[i].indexOf('%')) {
				var value = values[i].replace('%', "");
				value = parseFloat(value);

				if (value > 50) {
					results[value] = results[value] || { count: 0 };
					results[value].count++;
				}
			}
		}

		return results;
	});
}();
//# sourceMappingURL=cssUsage.min.js.map
