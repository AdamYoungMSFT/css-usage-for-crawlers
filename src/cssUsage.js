//
// Guards execution against invalid conditions
//
void function() {
    
    // Don't run in subframes for now
    if (top.location.href !== location.href) throw new Error("CSSUsage: the script doesn't run in frames for now");
    
    // Don't run if already ran
    if (window.CSSUsage) throw new Error("CSSUsage: only one run will be executed; check the right version was chosen");
    
}();

//
// Prepare our global namespace
//
void function() {
    window.CSSUsage = {};
    window.CSSUsageResults = {
        
        // this will contain the usage stats of various at-rules and rules
        types: [ 0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0, ], /* 
        types ~= {
            "unknown":0,   //0
            "style":0,     //1
            "charset": 0,  //2
            "import":0,    //3
            "media":0,     //4
            "font-face":0, //5
            "page":0,      //6
            "keyframes":0, //7 This is the @keyframe at rule
            "keyframe":0,  //8 This is the individual 0%, or from/to
            "reserved9":0, //9
            "namespace":0, //10
            "reserved11":0,//11
            "supports":0,  //12
            "reserved13":0,//13
            "reserved14":0,//14
            "viewport":0,  //15
        }*/
        
        // this will contain the usage stats of various css properties and values
        props: Object.create(null), /*
        props ~= {
            "background-color": {
                count: 10,
                values: {
                    "color": 9,
                    "inherit": 1
                }
            }
        }*/
        
        // this will contains the various datapoints we measure on css selector usage
        usages: {"SuccessfulCrawls":1},
        
        // this will contain selectors and the properties they refer to
        rules: {"@stylerule":0,"@atrule":0,"@inline":0}, /*
        rules ~= {
            "#id:hover .class": {
                count: 10,
                props: {
                    "background-color": 5,
                    "color": 4,
                    "opacity": 3,
                    "transform": 3
                }
            }
        }*/
        
    }
}();

//
// The StyleWalker API cover the extraction of style in the browser
//
void function() { "use strict";

    CSSUsage.StyleWalker = {
        
        // This array contains the list of functions being run on each CSSStyleDeclaration
        // [ function(style, selectorText, matchedElements, ruleType) { ... }, ... ]
        ruleAnalyzers: [],
        
        // This array contains the list of functions being run on each DOM element of the page
        // [ function(element) { ...} ]
        elementAnalyzers: [],
        
        // 
        walkOverCssStyles: walkOverCssStyles,
        walkOverDomElements: walkOverDomElements,
        
        // Those stats are being collected while walking over the css style rules
        amountOfInlineStyles: 0,
        amountOfSelectorsUnused: 0,
        amountOfSelectors: 0,
    }
    
    // holds @keyframes temporarily while we wait to know how much they are used
    var keyframes = {};
    
    /**
     * For all stylesheets of the document, 
     * walk through the stylerules and run analyzers
     */
    function walkOverCssStyles() {
        var styleSheets = document.styleSheets;

        // Loop through StyeSheets
        for (var ssIndex = styleSheets.length; ssIndex--;) {
            var styleSheet = styleSheets[ssIndex];
            try {
                if(styleSheet.cssRules) {
                    walkOverCssRules(styleSheet.cssRules, styleSheet);
                } else {
                    console.warn("No content loaded for stylesheet: ", styleSheet.href||styleSheet);
                }
            }
            catch (e) {
                console.log(e, e.stack);
            }
        }
        
        // Hack: rely on the results to find out which
        // animations actually run, and parse their keyframes
        var animations = (CSSUsageResults.props['animation-name']||{}).values||{};
        for(var animation in keyframes) {
            var keyframe = keyframes[animation];
            var matchCount = animations[animation]|0;
            var fakeElements = initArray(matchCount, (i)=>({tagName:'@keyframes '+animation+' ['+i+']'}));
            processRule(keyframe, fakeElements);
        }

    }

    /**
     * This is the css work horse, this will will loop over the
     * rules and then call the rule analyzers currently registered
     */
    function walkOverCssRules(/*CSSRuleList*/ cssRules, styleSheet, parentMatchedElements) {
        for (var ruleIndex = cssRules.length; ruleIndex--;) {

            // Loop through the rules
            var rule = cssRules[ruleIndex];

            // Until we can correlate animation usage
            // to keyframes do not parse @keyframe rules
            if(rule.type == 7) {
                keyframes[rule.name] = rule;
                continue;
            }
            
            // Filter "@supports" which the current browser doesn't support
            if(rule.type == 12 && (!CSS.supports || !CSS.supports(rule.conditionText))) {
                continue;
            }
                
            // Other rules should be processed immediately
            processRule(rule,parentMatchedElements);
                

        }
    }
    
    /**
     * This function takes a css rule and:
     * [1] walk over its child rules if needed
     * [2] call rule analyzers for that rule if it has style data
     */
    function processRule(rule, parentMatchedElements) {
        
        // Increment the rule type's counter
        CSSUsageResults.types[rule.type|0]++; 

        // Some CssRules have nested rules to walk through:
        if (rule.cssRules && rule.cssRules.length>0) {
            
            walkOverCssRules(rule.cssRules, rule.parentStyleSheet, parentMatchedElements);
            
        }

        // Some CssRules have style we can ananlyze
        if(rule.style) {
            
            // find what the rule applies to
            var selectorText;
            var matchedElements; 
            if(rule.selectorText) {
                selectorText = rule.selectorText;
                if(parentMatchedElements) {
                    matchedElements = [].slice.call(document.querySelectorAll(selectorText));
                    matchedElements.parentMatchedElements = parentMatchedElements;
                } else {
                    matchedElements = [].slice.call(document.querySelectorAll(selectorText));
                }
            } else {
                selectorText = '@atrule:'+rule.type;
                if(parentMatchedElements) {
                    matchedElements = parentMatchedElements;
                } else {
                    matchedElements = [];
                }
            }
            
            // run an analysis on it
            runRuleAnalyzers(rule.style, selectorText, matchedElements, rule.type);
            
        }
    }

    /**
     * This is the dom work horse, this will will loop over the
     * dom elements and then call the element analyzers currently registered,
     * as well as rule analyzers for inline styles
     */
    function walkOverDomElements(obj, index, depth) {
        obj = obj || document.documentElement; index = index|0; depth = depth|0;

        // Loop through the elements
        var elements = [].slice.call(document.all,0);
        for(var i=elements.length; i--;) { var element=elements[i];
        
            // Analyze the element
            runElementAnalyzers(element, index);
            
            // Analyze its style, if any
            if (element.hasAttribute('style')) {
                
                // Inline styles count like a style rule with no selector but one matched element
                var ruleType = 1;
                var isInline = true;
                var selectorText = '@inline:'+element.tagName;
                var matchedElements = [element];
                runRuleAnalyzers(element.style, selectorText, matchedElements, ruleType, isInline);
                
            }
        }
        
    }

    /**
     * Given a rule and its data, send it to all rule analyzers
     */
    function runRuleAnalyzers(style, selectorText, matchedElements, type, isInline) {
        
        // Keep track of the counters
        if(isInline) {
            CSSUsage.StyleWalker.amountOfInlineStyles++;
        } else {
            CSSUsage.StyleWalker.amountOfSelectors++;
        }
        
        // Run all rule analyzers
        CSSUsage.StyleWalker.ruleAnalyzers.forEach(function(runAnalyzer) {
            runAnalyzer(style, selectorText, matchedElements, type, isInline);
        });
        
    }
    
    /**
     * Given an element and its data, send it to all element analyzers
     */
    function runElementAnalyzers(element, index, depth) {
        CSSUsage.StyleWalker.elementAnalyzers.forEach(function(runAnalyzer) {
            runAnalyzer(element,index,depth);
        });
    }
    
    /**
     * Creates an array of "length" elements, by calling initializer for each cell
     */
    function initArray(length, initializer) {
        var array = Array(length);
        for(var i = length; i--;) { 
            array[i] = initializer(i);
        }
        return array;
    }

}();

//
// helper to work with css values
//
void function() {

    CSSUsage.CSSValues = {
        createValueArray: createValueArray,
        parseValues: parseValues,
        normalizeValue: normalizeValue
    };

    /**
     * This takes a string value and will create
     * an array from it.
     */
    function createValueArray(value, propertyName) {
        var values = new Array();

        value = normalizeValue(value, propertyName);

        // Parse values like: width 1s height 5s time 2s
        if (Array.isArray(value)) {

            value.forEach(function(val) {
                // We need to trim again as fonts at times will
                // be Font, Font2, Font3 and so we need to trim
                // the ones next to the commas
                val = val.trim();
                values.push(val);
            });

        }
        // Put the single value into an array so we get all values
        else {
            values = [value];
        }

        return values;
    }

    /**
     * This will take a string value and reduce it down
     * to only the aspects of the value we wish to keep
     */
    function parseValues(value,propertyName) {
        
        // Trim value on the edges
        value = value.trim();
        
        // Normalize letter-casing
        value = value.toLowerCase();

        // Map colors to a standard value (eg: white, blue, yellow)
        value = value.replace(/[#][0-9a-fA-F]+/g, '#000');
        if (isKeywordColor(value)) {
           return "color"; 
        }
        
        // Remove any digits eg: 55px -> px, 1.5 -> 0.0, 1 -> 0
        value = value.replace(/([+]|[-]|)(([0-9]+)([.][0-9]+|)|([.][0-9]+))([a-zA-Z%]+)/g, "$6"); 
        value = value.replace(/([+]|[-]|)([0-9]+)([.][0-9]+)/g, "0.0");
        value = value.replace(/([+]|[-]|)([.][0-9]+)/g, "0.0");
        value = value.replace(/([+]|[-]|)([0-9]+)/g, "0");
        
        // Remove quotes
        value = value.replace(/('|‘|’|")/g, "");
        
        //
        switch(propertyName) {
            case 'counter-increment':
            case 'counter-reset':
                
                // Anonymize the user identifier
                value = value.replace(/[-_a-zA-Z0-9]+/g,'iden');
                break;
                
            case 'grid':
            case 'grid-template':
            case 'grid-template-rows':
            case 'grid-template-columns':
            case 'grid-template-areas':
                
                // Anonymize line names
                value = value.replace(/\[[-_a-zA-Z0-9 ]+\]/g,'[names]');
                break;
                
            case '--var':
            
                // Replace {...} and [...]
                value = value.replace(/\[([^\[\]]+|\[[^\[\]]+\])+\]/g, "[...]");
                value = value.replace(/\{([^\{\}]+|\{[^\{\}]+\})+\}/g, "{...}");
                break;
                
        }
         
        return value;
         
    }

    //-----------------------------------------------------------------------------

    /**
     * This will normalize the values so that
     * we only keep the unique values
     */ 
    function normalizeValue(value, propertyName) {

        // Trim value on the edges
        value = value.trim();
        
        // Normalize letter-casing
        value = value.toLowerCase();

        // Remove (...)
        if (value.indexOf("(") != -1) {
            value = value.replace(/[(]([^()]+|[(]([^()]+)[)])+[)]/g, "");
        }
        
        // Do the right thing in function of the property
        switch(propertyName) {
            case 'font-family':
                
                // Remove various quotes
                if (value.indexOf("'") != -1 || value.indexOf("‘") != -1 || value.indexOf('"')) {
                    value = value.replace(/('|‘|’|")/g, "");
                }
                
                // Divide at commas to separate different font names
                value = value.split(",");
                return value;
                
            case '--var':
            
                // Group {...} and [...]
                value = value.replace(/\[([^\[\]]+|\[[^\[\]]+\])+\]/g, "[...]");
                value = value.replace(/\{([^\{\}]+|\{[^\{\}]+\})+\}/g, "{...}");
                break;
                
        }
        
        // Replace strings by dummies
        value = value.replace(/"([^"]|\\")*"/g,'"..."')
                     .replace(/'([^']|\\')*'/g,'"..."');
        
        // Divide at commas and spaces to separate different values
        value = value.split(/\s*,\s*|\s+/g);
        
        return value;
    }

    /**
     * So that we don't end up with a ton of color
     * values, this will determine if the color is a
     * keyword color value
     */
    function isKeywordColor(candidateColor) {
        
        // Keyword colors from the W3C specs
        var isColorKeyword = /^(aliceblue|antiquewhite|aqua|aquamarine|azure|beige|bisque|black|blanchedalmond|blue|blueviolet|brown|burlywood|cadetblue|chartreuse|chocolate|coral|cornflowerblue|cornsilk|crimson|cyan|darkblue|darkcyan|darkgoldenrod|darkgray|darkgreen|darkkhaki|darkmagenta|darkolivegreen|darkorange|darkorchid|darkred|darksalmon|darkseagreen|darkslateblue|darkslategray|darkturquoise|darkviolet|deeppink|deepskyblue|dimgray|dodgerblue|firebrick|floralwhite|forestgreen|fuchsia|gainsboro|ghostwhite|gold|goldenrod|gray|green|greenyellow|honeydew|hotpink|indianred|indigo|ivory|khaki|lavender|lavenderblush|lawngreen|lemonchiffon|lightblue|lightcoral|lightcyan|lightgoldenrodyellow|lightgreen|lightgrey|lightpink|lightsalmon|lightseagreen|lightskyblue|lightslategray|lightsteelblue|lightyellow|lime|limegreen|linen|magenta|maroon|mediumaquamarine|mediumblue|mediumorchid|mediumpurple|mediumseagreen|mediumslateblue|mediumspringgreen|mediumturquoise|mediumvioletred|midnightblue|mintcream|mistyrose|moccasin|navajowhite|navy|navyblue|oldlace|olive|olivedrab|orange|orangered|orchid|palegoldenrod|palegreen|paleturquoise|palevioletred|papayawhip|peachpuff|peru|pink|plum|powderblue|purple|red|rosybrown|royalblue|saddlebrown|salmon|sandybrown|seagreen|seashell|sienna|silver|skyblue|slateblue|slategray|snow|springgreen|steelblue|tan|teal|thistle|tomato|turquoise|violet|wheat|white|whitesmoke|yellow|yellowgreen)$/;
        return isColorKeyword.test(candidateColor);
        
    }

}();

//
// computes various css stats
//
void function() {

    CSSUsage.PropertyValuesAnalyzer = analyzeStyleOfRule;
    CSSUsage.PropertyValuesAnalyzer.cleanSelectorText = cleanSelectorText;
    CSSUsage.PropertyValuesAnalyzer.generalizedSelectorsOf = generalizedSelectorsOf;

    // We put a computed style in cache for filtering purposes
    var defaultStyle = getComputedStyle(document.createElement('div'));
    
    /** This will loop over the styles declarations */
    function analyzeStyleOfRule(style, selectorText, matchedElements, type, isInline) { isInline=!!isInline;
        
        // We want to filter rules that are not actually used
        var count = matchedElements.length;
        var selector = selectorText;
        var selectorCat = {'1:true':'@inline','1:false':'@stylerule'}[''+type+':'+isInline]||'@atrule';
        var isRuleUnsed = () => (count == 0);
        
        // Keep track of unused rules
        if(isRuleUnsed()) {
            CSSUsage.StyleWalker.amountOfSelectorsUnused++;
        }
        
        // We need a generalized selector to collect some stats
        var generalizedSelectors = (
            (selectorCat=='@stylerule')
                ? [selectorCat].concat(generalizedSelectorsOf(selector))
                : [selectorCat, selector]
        );
        
        // Get the datastores of the generalized selectors
        var generalizedSelectorsData = generalizedSelectors.map((generalizedSelector) => (
            CSSUsageResults.rules[generalizedSelector] || (CSSUsageResults.rules[generalizedSelector] = {count:0,props:{}})
        ));
        
        // Increment the occurence counter of found generalized selectors
        generalizedSelectorsData.forEach((generalizedSelectorData) => {
            generalizedSelectorData.count++
        })
		
		// avoid most common browser lies
		var cssText = ' '+style.cssText; 
		if(navigator.userAgent.indexOf('Edge')>=0) {
			cssText = cssText.replace(/border: medium; border-image: none;/i,'border: none;');
			cssText = cssText.replace(/ border-image: none;/i,'');
		}

        
        // For each property declaration in this rule, we collect some stats
        for (var i = style.length; i--;) {

            var key = style[i], rootKey = key.replace(/[-].*/,'');
            var normalizedKey = key.replace(/^--.*/,'--var');
            var styleValue = style.getPropertyValue(key);
            
            // Only keep styles that were declared by the author
            // We need to make sure we're only checking string props
            var isValueInvalid = () => (typeof styleValue !== 'string' && styleValue != "" && styleValue != undefined);
            var isPropertyUndefined = () => (((' '+cssText).indexOf(' '+key+':') == -1) && (styleValue=='initial' || !valueExistsInRootProperty(key, styleValue)));
			var getBuggyValuesForThisBrowser = function() {
				var buggyValues = getBuggyValuesForThisBrowser.cache;
				if(buggyValues) { return buggyValues; }
				else { buggyValues = {}; }
				
				// Edge reports initial value instead of "initial", we have to be cautious
				if(navigator.userAgent.indexOf('Edge')>=0) {

					buggyValues['*'] = 1; // make 0 values automatic for longhand properties
					
					//buggyValues['list-style-position:outside'] = 0;
					buggyValues['list-style-image:none'] = 1;
					//buggyValues['outline-color:invert'] = 0;
					//buggyValues['outline-style:none'] = 0;
					//buggyValues['outline-width:medium'] = 0;
					//buggyValues['background-image:none'] = 0;
					//buggyValues['background-attachment:scroll'] = 0;
					//buggyValues['background-repeat:repeat'] = 0;
					//buggyValues['background-repeat-x:repeat'] = 0;
					//buggyValues['background-repeat-y:repeat'] = 0;
					//buggyValues['background-position-x:0%'] = 0;
					//buggyValues['background-position-y:0%'] = 0;
					//buggyValues['background-size:auto'] = 0;
					//buggyValues['background-origin:padding-box'] = 0;
					//buggyValues['background-clip:border-box'] = 0;
					//buggyValues['background-color:transparent'] = 0;
					buggyValues['border-top-color:currentcolor'] = 1;
					buggyValues['border-right-color:currentcolor'] = 1;
					buggyValues['border-bottom-color:currentcolor'] = 1;
					buggyValues['border-left-color:currentcolor'] = 1;
					//buggyValues['border-top-style:solid'] = 0;
					//buggyValues['border-right-style:solid'] = 0;
					//buggyValues['border-bottom-style:solid'] = 0;
					//buggyValues['border-left-style:solid'] = 0;
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
					//buggyValues['font-size-adjust:none'] = 0;
					buggyValues['font-stretch:normal'] = 1;
					
				}
				
				// Firefox reports initial values instead of "initial", we have to be cautious
				if(navigator.userAgent.indexOf('Firefox')>=0) {
					
					buggyValues['*'] = 1; // make 0 values automatic for longhand properties
					
				}
				
				return getBuggyValuesForThisBrowser.cache = buggyValues;

			};
            var valueExistsInRootProperty = (key,value) => { 
				value = value.trim();
				
				// detect suspicious values
				var buggyValues = getBuggyValuesForThisBrowser();
				
				// apply common sense to the given value, per browser
				var buggyState = buggyValues[(key+':'+value).toLowerCase()];
				if(buggyState === 1) { return false; }
				if(buggyState !== 0 && (!buggyValues['*'] || CSSShorthands.unexpand(key).length == 0)) { return true; }
								
                // ask the browser is the best we can do right now
                var rootKey = key.split("-")[0]; if(key==rootKey) return false;
                var values = value.split(/\s+|\s*,\s*/g);
                var result = values.every((value) => (new RegExp(' '+rootKey+'(?:[-][-_a-zA-Z0-9]+)?[:][^;]*'+value.trim().replace(/([.*+?^=!:${}()|\[\]\/\\])/g, "\\$1"),'gi')).test(cssText));
                return result;
				
            };
            
            if (isValueInvalid() || isPropertyUndefined()) {
                continue;
            }
            
            // divide the value into simplified components
            var values = (
                CSSUsage.CSSValues.createValueArray(styleValue,normalizedKey) // split in components
                .map(v => CSSUsage.CSSValues.parseValues(v,normalizedKey)) // simplify them
                .filter(v => v.trim()) // don't keep empty ones
            );
            
            // log the property usage per selector
            generalizedSelectorsData.forEach((generalizedSelectorData) => {
                
                // get the datastore for current property
                var propStats = generalizedSelectorData.props[normalizedKey] || (generalizedSelectorData.props[normalizedKey] = {count:0,values:{}});

                // we saw the property one time
                propStats.count++;
                
                // we also saw a bunch of values
                values.forEach(function (value) {
                    
                    // increment the counts for those by one, too
                    propStats.values[value] = (propStats.values[value]|0) + 1
                    
                });
                
            });
            
            // if we may increment some counts due to this declaration
            if(count > 0) {
                
                // instanciate or fetch the property metadata
                var propObject = CSSUsageResults.props[normalizedKey];
                if (!propObject) {
                    propObject = CSSUsageResults.props[normalizedKey] = {
                        count: 0,
                        values: {}
                    };
                }
                
                // update the occurence counts of the property and value
                matchedElements.forEach(element => {
                    
                    // check what the elements already contributed for this property
                    var knownValues = element['CSSUsage:'+normalizedKey] || (element['CSSUsage:'+normalizedKey] = []);
                    
                    // increment the amount of affected elements which we didn't count yet
                    if(knownValues.length == 0) { propObject.count += 1; }

                    // add newly found values too
                    values.forEach(function (value) {
                        
                        if(knownValues.indexOf(value) >= 0) { return; }
                        propObject.values[value] = (propObject.values[value]|0) + 1;
                        knownValues.push(value);

                    });
                    
                });
                
            }
            
        }
    }

    //-------------------------------------------------------------------------

    /**
     * If you try to do querySelectorAll on pseudo selectors
     * it returns 0 because you are not actually doing the action the pseudo is stating those things,
     * but we will honor those declarations and we don't want them to be missed,
     * so we remove the pseudo selector from the selector text
     */
    function cleanSelectorText(text) {
        if(text.indexOf(':') == -1) {
            return text;
        } else {
            return text.replace(/([-_a-zA-Z0-9*]?):(?:hover|active|focus|before|after)|::(?:before|after)*/g, '>>$1<<').replace(/^>><</g,'*').replace(/ >><</g,'*').replace(/>>([*a-zA-Z]?)<</g,'$1');
        }
    }
    
    /**
     * Returns an anonimized version of the selector.
     * @example "#menu.open:hover>a.submenu" => "#id.class:hover > a.class"
     */
    function generalizedSelectorsOf(value) {
        
        // Trim
        value = value.trim();
        
        // Remove (...)
        if (value.indexOf("(") != -1) {
            value = value.replace(/[(]([^()]+|[(]([^()]+)[)])+[)]/g, "");
        }
        
        // Remove whitespace
        if (value.indexOf("(") != -1) {
            value = value.replace(/\s+/g, " ");
        }
        
        // Simplify [att]
        if (value.indexOf("[") != -1) {
            value = value.replace(/\[[^\[\]]+\]/g, "[att]");
        }
        
        // Simplify .class
        if (value.indexOf(".") != -1) {
            value = value.replace(/[.][-_a-zA-Z][-_a-zA-Z0-9]*/g, ".class");
        }
        
        // Simplify #id
        if (value.indexOf("#") != -1) {
            value = value.replace(/[#][-_a-zA-Z][-_a-zA-Z0-9]*/g, "#id");
        }
        
        // Normalize combinators
        value = value.replace(/[ ]*([>|+|~])[ ]*/g,' $1 ');
        
        // Trim whitespace
        value = value.trim();
        
        // Remove unnecessary * to match Chrome
        value = value.replace(/[*]([#.\x5B:])/g,'$1');
        
        // Now we can sort components so that all browsers give results similar to Chrome
        var ID_REGEXP = "[#]id";          // #id
        var CLASS_REGEXP = "[.]class"; // .class
        var ATTR_REGEXP = "\\[att\\]";    // [att]
        var PSEUDO_REGEXP = "[:][:]?[-_a-zA-Z][-_a-zA-Z0-9]*"; // :pseudo
        var SORT_REGEXPS = [
            
            // #id first
            new RegExp("("+CLASS_REGEXP+")("+ID_REGEXP+")",'g'),
            new RegExp("("+ATTR_REGEXP+")("+ID_REGEXP+")",'g'),
            new RegExp("("+PSEUDO_REGEXP+")("+ID_REGEXP+")",'g'),
            
            // .class second
            new RegExp("("+ATTR_REGEXP+")("+CLASS_REGEXP+")",'g'),
            new RegExp("("+PSEUDO_REGEXP+")("+CLASS_REGEXP+")",'g'),
            
            // [attr] third
            new RegExp("("+PSEUDO_REGEXP+")("+ATTR_REGEXP+")",'g'),
            
            // :pseudo last
            
        ];
        
        var oldValue; do { // Yeah this is a very inefficient bubble sort. I know.
            
            oldValue = value;
            for(var wrongPair of SORT_REGEXPS) {
                value = value.replace(wrongPair,'$2$1');
            }
            
        } while(oldValue != value);
        
        // Split multiple selectors
        value = value.split(/\s*,\s*/);

        return value;

    }

}();

//
// extracts valuable informations about selectors in use
//
void function() {
    
    // 
    // To understand framework and general css usage, we collect stats about classes, ids and pseudos.
    // Those objects have the following shape: 
    // {"hover":5,"active":1,"focus":2}
    // 
    var cssPseudos = Object.create(null); // collect stats about which pseudo-classes and pseudo-elements are used in the css
    var domClasses = Object.create(null); // collect stats about which css classes are found in the <... class> attributes of the dom
    var cssClasses = Object.create(null); // collect stats about which css classes are used in the css
    var domIds = Object.create(null);     // collect stats about which ids are found in the <... id> attributes of the dom
    var cssIds = Object.create(null);     // collect stats about which ids are used in the css
    
    // 
    // To understand Modernizer usage, we need to know how often some classes are used at the front of a selector
    // While we're at it, the code also collect the state for ids
    // 
    var cssLonelyIdGates = Object.create(null);    // .class something-else ==> {"class":1}
    var cssLonelyClassGates = Object.create(null); // #id something-else ==> {"id":1}
    var cssLonelyClassGatesMatches = [];           // .class something-else ==> [".class something-else"]
    var cssLonelyIdGatesMatches = [];              // #id something-else ==> ["#id something-else"]
    
    //
    // These regular expressions catch patterns we want to track (see before)
    //
    var ID_REGEXP = /[#][-_a-zA-Z][-_a-zA-Z0-9]*/g;     // #id
    var ID_REGEXP1 = /[#][-_a-zA-Z][-_a-zA-Z0-9]*/;     // #id (only the first one)
    var CLASS_REGEXP = /[.][-_a-zA-Z][-_a-zA-Z0-9]*/g;  // .class
    var CLASS_REGEXP1 = /[.][-_a-zA-Z][-_a-zA-Z0-9]*/;  // .class (only the first one)
    var PSEUDO_REGEXP = /[:][-_a-zA-Z][-_a-zA-Z0-9]*/g; // :pseudo (only the )
    var GATEID_REGEXP = /^\s*[#][-_a-zA-Z][-_a-zA-Z0-9]*([.][-_a-zA-Z][-_a-zA-Z0-9]*|[:][-_a-zA-Z][-_a-zA-Z0-9]*)*\s+[^>+{, ][^{,]+$/; // #id ...
    var GATECLASS_REGEXP = /^\s*[.][-_a-zA-Z][-_a-zA-Z0-9]*([:][-_a-zA-Z][-_a-zA-Z0-9]*)*\s+[^>+{, ][^{,]+$/; // .class ...
    
    /**
     * From a css selector text and a set of counters, 
     * increment the counters for the matches in the selector of the 'feature' regular expression
     */
    function extractFeature(feature, selector, counters) {
        var instances = (selector.match(feature)||[]).map(function(s) { return s.substr(1) });
        instances.forEach((instance) => {
            counters[instance] = (counters[instance]|0) + 1;
        });
    }
    
    /**
     * This analyzer will collect over the selectors the stats defined before
     */
    CSSUsage.SelectorAnalyzer = function parseSelector(style, selectorsText) {
        if(typeof selectorsText != 'string') return;
            
        var selectors = selectorsText.split(',');
        for(var i = selectors.length; i--;) { var selector = selectors[i];
            
            // extract all features from the selectors
            extractFeature(ID_REGEXP, selector, cssIds);
            extractFeature(CLASS_REGEXP, selector, cssClasses);
            extractFeature(PSEUDO_REGEXP, selector, cssPseudos);
            
            // detect specific selector patterns we're interested in
            if(GATEID_REGEXP.test(selector)) {
                cssLonelyIdGatesMatches.push(selector);
                extractFeature(ID_REGEXP1, selector, cssLonelyIdGates);
            }
            if(GATECLASS_REGEXP.test(selector)) {
                cssLonelyClassGatesMatches.push(selector);
                extractFeature(CLASS_REGEXP1, selector, cssLonelyClassGates);
            }
        }
        
    }
    
    /**
     * This analyzer will collect over the dom elements the stats defined before
     */
    CSSUsage.DOMClassAnalyzer = function(element) {
        
        // collect classes used in the wild
        if(element.className) {
            var elementClasses = [].slice.call(element.classList,0);
            elementClasses.forEach(function(c) {
                domClasses[c] = (domClasses[c]|0) + 1;
            });
        }
        
        // collect ids used in the wild
        if(element.id) {
            domIds[element.id] = (domIds[element.id]|0) + 1;
        }
        
    }
    
    /**
     * This function will be called when all stats have been collected
     * at which point we will agregate some of them in useful values like Bootstrap usages, etc...
     */
    CSSUsage.SelectorAnalyzer.finalize = function() {
        
        // get arrays of the classes/ids used ({"hover":5} => ["hover"]))
        var domClassesArray = Object.keys(domClasses);
        var cssClassesArray = Object.keys(cssClasses);
        var domIdsArray = Object.keys(domIds);
        var cssIdsArray = Object.keys(cssIds);

        // get arrays of the .class gates used ({"hover":5} => ["hover"]), filter irrelevant entries
        var cssUniqueLonelyClassGatesArray = Object.keys(cssLonelyClassGates);
        var cssUniqueLonelyClassGatesUsedArray = cssUniqueLonelyClassGatesArray.filter((c) => domClasses[c]);
        var cssUniqueLonelyClassGatesUsedWorthArray = cssUniqueLonelyClassGatesUsedArray.filter((c)=>(cssLonelyClassGates[c]>9));
        if(window.debugCSSUsage) console.log(cssLonelyClassGates);
        if(window.debugCSSUsage) console.log(cssUniqueLonelyClassGatesUsedWorthArray);

        // get arrays of the #id gates used ({"hover":5} => ["hover"]), filter irrelevant entries
        var cssUniqueLonelyIdGatesArray = Object.keys(cssLonelyIdGates);
        var cssUniqueLonelyIdGatesUsedArray = cssUniqueLonelyIdGatesArray.filter((c) => domIds[c]);
        var cssUniqueLonelyIdGatesUsedWorthArray = cssUniqueLonelyIdGatesUsedArray.filter((c)=>(cssLonelyIdGates[c]>9));
        if(window.debugCSSUsage) console.log(cssLonelyIdGates);
        if(window.debugCSSUsage) console.log(cssUniqueLonelyIdGatesUsedWorthArray);
        
        //
        // report how many times the classes in the following arrays have been used in the dom
        // (general stats)
        //
        
        /** count how many times the usual clearfix classes are used */
        var detectedClearfixUsages = function(domClasses) {
            
            var trackedClasses = [
                'clearfix','clear',
            ];
            
            return trackedClasses.reduce((a,b) => a+(domClasses[b]|0), 0);
            
        };
        
        /** count how many times the usual hide/show classes are used */
        var detectedVisibilityUsages = function(domClasses) {
            
            var trackedClasses = [
                'show', 'hide', 'visible', 'hidden', 
            ];
            
            return trackedClasses.reduce((a,b) => a+(domClasses[b]|0), 0);
            
        };
        
        //
        // report how many times the classes in the following arrays have been used in the dom
        // (bootstrap stats)
        //
        
        var detectedBootstrapGridUsages = function(domClasses) {
            
            var trackedClasses = [];
            
            var sizes = ['xs','sm','md','lg'];
            for(var i = sizes.length; i--;) { var size = sizes[i];
                for(var j = 12+1; --j;) {
                    trackedClasses.push('col-'+size+'-'+j);
                    for(var k = 12+1; --k;) {
                        trackedClasses.push('col-'+size+'-'+j+'-offset-'+k);
                        trackedClasses.push('col-'+size+'-'+j+'-push-'+k);
                        trackedClasses.push('col-'+size+'-'+j+'-pull-'+k);
                    }
                }
            }
            
            return trackedClasses.reduce((a,b) => a+(domClasses[b]|0), 0);
            
        };
        
        var detectedBootstrapFormUsages = function(domClasses) {
            
            var trackedClasses = [
                'form-group', 'form-group-xs', 'form-group-sm', 'form-group-md', 'form-group-lg',
                'form-control', 'form-horizontal', 'form-inline',
                'btn','btn-primary','btn-secondary','btn-success','btn-warning','btn-danger','btn-error'
            ];
            
            return trackedClasses.reduce((a,b) => a+(domClasses[b]|0), 0);
            
        };
        
        var detectedBootstrapAlertUsages = function(domClasses) {
            
            var trackedClasses = [
                'alert','alert-primary','alert-secondary','alert-success','alert-warning','alert-danger','alert-error'
            ];
            
            return trackedClasses.reduce((a,b) => a+(domClasses[b]|0), 0);
            
        };
        
        var detectedBootstrapFloatUsages = function(domClasses) {
            
            var trackedClasses = [
                'pull-left','pull-right',
            ];
            
            return trackedClasses.reduce((a,b) => a+(domClasses[b]|0), 0);
            
        };
        
        //
        // report how many times the classes in the following arrays have been used as css gate
        // (modernizer stats)
        //
        
        // https://modernizr.com/docs#features
        var detectedModernizerUsages = function(cssLonelyClassGates) {
            
            var ModernizerUsages = {count:0,values:{/*  "js":1,  "no-js":2  */}};
            var trackedClasses = ["js","ambientlight","applicationcache","audio","batteryapi","blobconstructor","canvas","canvastext","contenteditable","contextmenu","cookies","cors","cryptography","customprotocolhandler","customevent","dart","dataview","emoji","eventlistener","exiforientation","flash","fullscreen","gamepads","geolocation","hashchange","hiddenscroll","history","htmlimports","ie8compat","indexeddb","indexeddbblob","input","search","inputtypes","intl","json","olreversed","mathml","notification","pagevisibility","performance","pointerevents","pointerlock","postmessage","proximity","queryselector","quotamanagement","requestanimationframe","serviceworker","svg","templatestrings","touchevents","typedarrays","unicoderange","unicode","userdata","vibrate","video","vml","webintents","animation","webgl","websockets","xdomainrequest","adownload","audioloop","audiopreload","webaudio","lowbattery","canvasblending","todataurljpeg,todataurlpng,todataurlwebp","canvaswinding","getrandomvalues","cssall","cssanimations","appearance","backdropfilter","backgroundblendmode","backgroundcliptext","bgpositionshorthand","bgpositionxy","bgrepeatspace,bgrepeatround","backgroundsize","bgsizecover","borderimage","borderradius","boxshadow","boxsizing","csscalc","checked","csschunit","csscolumns","cubicbezierrange","display-runin","displaytable","ellipsis","cssescape","cssexunit","cssfilters","flexbox","flexboxlegacy","flexboxtweener","flexwrap","fontface","generatedcontent","cssgradients","hsla","csshyphens,softhyphens,softhyphensfind","cssinvalid","lastchild","cssmask","mediaqueries","multiplebgs","nthchild","objectfit","opacity","overflowscrolling","csspointerevents","csspositionsticky","csspseudoanimations","csspseudotransitions","cssreflections","regions","cssremunit","cssresize","rgba","cssscrollbar","shapes","siblinggeneral","subpixelfont","supports","target","textalignlast","textshadow","csstransforms","csstransforms3d","preserve3d","csstransitions","userselect","cssvalid","cssvhunit","cssvmaxunit","cssvminunit","cssvwunit","willchange","wrapflow","classlist","createelementattrs,createelement-attrs","dataset","documentfragment","hidden","microdata","mutationobserver","bdi","datalistelem","details","outputelem","picture","progressbar,meter","ruby","template","time","texttrackapi,track","unknownelements","es5array","es5date","es5function","es5object","es5","strictmode","es5string","es5syntax","es5undefined","es6array","contains","generators","es6math","es6number","es6object","promises","es6string","devicemotion,deviceorientation","oninput","filereader","filesystem","capture","fileinput","directory","formattribute","localizednumber","placeholder","requestautocomplete","formvalidation","sandbox","seamless","srcdoc","apng","jpeg2000","jpegxr","sizes","srcset","webpalpha","webpanimation","webplossless,webp-lossless","webp","inputformaction","inputformenctype","inputformmethod","inputformtarget","beacon","lowbandwidth","eventsource","fetch","xhrresponsetypearraybuffer","xhrresponsetypeblob","xhrresponsetypedocument","xhrresponsetypejson","xhrresponsetypetext","xhrresponsetype","xhr2","scriptasync","scriptdefer","speechrecognition","speechsynthesis","localstorage","sessionstorage","websqldatabase","stylescoped","svgasimg","svgclippaths","svgfilters","svgforeignobject","inlinesvg","smil","textareamaxlength","bloburls","datauri","urlparser","videoautoplay","videoloop","videopreload","webglextensions","datachannel","getusermedia","peerconnection","websocketsbinary","atob-btoa","framed","matchmedia","blobworkers","dataworkers","sharedworkers","transferables","webworkers"];
            trackedClasses.forEach(function(c) { countInstancesOfTheClass(c); countInstancesOfTheClass('no-'+c); });
            return ModernizerUsages;
            
            function countInstancesOfTheClass(c) {
                var count = cssLonelyClassGates[c]; if(!count) return; 
                ModernizerUsages.count += count; 
                ModernizerUsages.values[c]=count; 
            }
            
        }
        
        //
        // try to detect other popular frameworks
        //
        
        // https://github.com/Dogfalo/materialize/blob/master/sass/components/_grid.scss
        var hasDogfaloMaterializeUsage = function() {
            
            if(!document.querySelector(".container > .row > .col")) {
                return false;
            }
            
            for(var i = 12+1; --i;) {
                for(var s of ['s','m','l']) {
                    if(document.querySelector(".container > .row > .col."+s+""+i)) {
                        return true;
                    }
                }
            }
            return false;
            
        }
        
        // http://blueprintcss.org/tests/parts/grid.html
        var hasBluePrintUsage = function() {
            
            if(!document.querySelector(".container")) {
                return false;
            }
            
            for(var i = 24+1; --i;) {
                if(document.querySelector(".container > .span-"+i)) {
                    return true;
                }
            }
            return false;
            
        }
        
        // https://raw.githubusercontent.com/csswizardry/inuit.css/master/generic/_widths.scss
        var hasInuitUsage = function() {
            
            if(!document.querySelector(".grid .grid__item")) {
                return false;
            }
            
            for(var fraction of ["one-whole","one-half","one-third","two-thirds","one-quarter","two-quarters","one-half","three-quarters","one-fifth","two-fifths","three-fifths","four-fifths","one-sixth","two-sixths","one-third","three-sixths","one-half","four-sixths","two-thirds","five-sixths","one-eighth","two-eighths","one-quarter","three-eighths","four-eighths","one-half","five-eighths","six-eighths","three-quarters","seven-eighths","one-tenth","two-tenths","one-fifth","three-tenths","four-tenths","two-fifths","five-tenths","one-half","six-tenths","three-fifths","seven-tenths","eight-tenths","four-fifths","nine-tenths","one-twelfth","two-twelfths","one-sixth","three-twelfths","one-quarter","four-twelfths","one-third","five-twelfths","six-twelfths","one-half","seven-twelfths","eight-twelfths","two-thirds","nine-twelfths","three-quarters","ten-twelfths","five-sixths","eleven-twelfths"]) {
                for(var ns of ["","palm-","lap-","portable-","desk-"]) {
                    if(document.querySelector(".grid > .grid__item."+ns+fraction)) {
                        return true;
                    }
                }
            }
            return false;
            
        }
        
        // http://www.gumbyframework.com/docs/grid/#!/basic-grid
        var hasGrumbyUsage = function() {
            
            if(!document.querySelector(".row .columns")) {
                return false;
            }
            
            for(var fraction of ["one","two","three","four","five","six","seven","eight","nine","ten","eleven","twelve"]) {
                if(document.querySelector(".row > .columns."+fraction)) {
                    return true;
                }
            }
            return false;
            
        }

        //
        //
        //
        var results = {
            
            // how many crawls are aggregated in this file (one of course in this case)
            SuccessfulCrawls: 1,
            
            // how many elements on the page (used to compute percentages for css.props)
            DOMElements: document.all.length,
            
            // how many selectors vs inline style, and other usage stats
            SelectorsFound: CSSUsage.StyleWalker.amountOfSelectors,
            InlineStylesFound: CSSUsage.StyleWalker.amountOfInlineStyles,
            SelectorsUnused: CSSUsage.StyleWalker.amountOfSelectorsUnused,
            
            // ids stats
            IdsUsed: domIdsArray.length,
            IdsRecognized: Object.keys(cssIds).length,
            IdsUsedRecognized: domIdsArray.filter(i => cssIds[i]).length,
            
            // classes stats
            ClassesUsed: domClassesArray.length,
            ClassesRecognized: Object.keys(cssClasses).length,
            ClassesUsedRecognized: domClassesArray.filter(c => cssClasses[c]).length,
            
            // non-framework usage stats (see before)
            NFwkClearfixUsage: detectedClearfixUsages(domClasses),
            NFwkVisibilityUsage: detectedVisibilityUsages(domClasses),
            
            NFwkClearfixRecognized: detectedClearfixUsages(cssClasses),
            NFwkVisibilityRecognized: detectedVisibilityUsages(cssClasses),
            
            // framework usage stats (see before)
            FwkModernizer: !!window.Modernizer,
            FwkModernizerDOMUsages: detectedModernizerUsages(domClasses),
            FwkModernizerCSSUsages: detectedModernizerUsages(cssLonelyClassGates),
           
            FwkBootstrap: !!((window.jQuery||window.$) && (window.jQuery||window.$).fn && (window.jQuery||window.$).fn.modal)|0,
            
            FwkBootstrapGridUsage: detectedBootstrapGridUsages(domClasses),
            FwkBootstrapFormUsage: detectedBootstrapFormUsages(domClasses),
            FwkBootstrapFloatUsage: detectedBootstrapFloatUsages(domClasses),
            FwkBootstrapAlertUsage: detectedBootstrapAlertUsages(domClasses),
            
            FwkBootstrapGridRecognized: detectedBootstrapGridUsages(cssClasses),
            FwkBootstrapFormRecognized: detectedBootstrapFormUsages(cssClasses),
            FwkBootstrapFloatRecognized: detectedBootstrapFloatUsages(cssClasses),
            FwkBootstrapAlertRecognized: detectedBootstrapAlertUsages(cssClasses),
            
            FwkDogfaloMaterialize: hasDogfaloMaterializeUsage()|0,
            FwkBluePrint: hasBluePrintUsage()|0,
            FwkInuit: hasInuitUsage()|0,
            FwkGrumby: hasGrumbyUsage()|0,
            
        };
        
        if(window.debugCSSUsage) console.log(CSSUsageResults.usages = results);
        
    }
        
}();

//
// Execution scheduler:
// This is where we decide what to run, and when
//
void function() {

    if(document.readyState !== 'complete') {
        
        // if the document is loading, run when it loads or in 10s, whichever is less
        window.addEventListener('load', onready);
        setTimeout(onready, 10000);
        
    } else {
        
        // if the document is ready, run now
        onready();
        
    }

    /**
     * This is the main entrypoint of our script
     */
    function onready() {
        
        // Uncomment if you want to set breakpoints when running in the console
        //debugger;
        
        // Prevent this code from running multiple times
        var firstTime = !onready.hasAlreadyRun; onready.hasAlreadyRun = true;
        if(!firstTime) { return; /* for now... */ }
		
		// Prevent this code from running when the page has no stylesheet (probably a redirect page)
		if(document.styleSheets.length == 0) { return; }

        // Keep track of duration
        var startTime = performance.now();

        // register tools
        CSSUsage.StyleWalker.ruleAnalyzers.push(CSSUsage.PropertyValuesAnalyzer);
        CSSUsage.StyleWalker.ruleAnalyzers.push(CSSUsage.SelectorAnalyzer);
        CSSUsage.StyleWalker.elementAnalyzers.push(CSSUsage.DOMClassAnalyzer);

        // perform analysis
        CSSUsage.StyleWalker.walkOverDomElements();
        CSSUsage.StyleWalker.walkOverCssStyles();
        CSSUsage.SelectorAnalyzer.finalize();

        // Update duration
        CSSUsageResults.duration = (performance.now() - startTime)|0;

        // DO SOMETHING WITH THE CSS OBJECT HERE
        if(window.debugCSSUsage) console.log(CSSUsageResults);
        if(window.onCSSUsageResults) {
            window.onCSSUsageResults(CSSUsageResults);
        };
        
    }


}();