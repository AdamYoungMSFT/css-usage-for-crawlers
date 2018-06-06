function TestContainer(container)
{
    return (container.transform != null && container.transform.baseVal.consolidate() != null);
}

function GetTreeDepth(node)
{
    var tagList = [ "svg", "a", "g", "marker", "mask", "missing-glyph", "pattern", "switch", "symbol" ];
    var maxDepthBelow = 0;

    for (var i = 0; i < tagList.length; i++)
    {
        var tagChildren = node.getElementsByTagName(tagList[i]);
        for (var j = 0; j < tagChildren.length; j++)
        {
            maxDepthBelow = Math.max(maxDepthBelow, GetTreeDepth(tagChildren[j]));
        }
    }

    return maxDepthBelow + 1;
}

void function() {
    document.addEventListener('DOMContentLoaded', function () {
        var count = 0;
        var processed = {};

        var knownContainers = document.querySelectorAll('svg, svg a, svg g, svg marker, svg mask, svg missing-glyph, svg pattern, svg switch, svg symbol');
        for (var container of knownContainers) {
            if (!(container in processed))
            {
                processed[container] = true;
                if (TestContainer(container)) {
                    ++count;
                }
            }
        }

        // SVG elements with markers are treated like containers
        var elevatedContainers = document.querySelectorAll(
            'svg path[marker-start]:not([marker-start=""]), svg path[marker-mid]:not([marker-mid=""]), svg path[marker-end]:not([marker-end=""]),' +
            'svg line[marker-start]:not([marker-start=""]), svg line[marker-mid]:not([marker-mid=""]), svg line[marker-end]:not([marker-end=""]),' +
            'svg polyline[marker-start]:not([marker-start=""]), svg polyline[marker-mid]:not([marker-mid=""]), svg polyline[marker-end]:not([marker-end=""]),' +
            'svg polygon[marker-start]:not([marker-start=""]), svg polygon[marker-mid]:not([marker-mid=""]), svg polygon[marker-end]:not([marker-end=""])'
            );
        for (var container of elevatedContainers) {
            if (!(container in processed))
            {
                processed[container] = true;
                if (TestContainer(container)) {
                    ++count;
                }
            }
        }

        var maxDepth = 0;
        var SVG_elements = document.getElementsByTagName("svg");
        for (var i = 0; i < SVG_elements.length; i++)
        {
            maxDepth = Math.max(maxDepth, GetTreeDepth(SVG_elements[i]));
        }

        appendResults(count);
        appendResults(maxDepth);
        
        // Add it to the document dom
        function appendResults(results) {
            if(window.debugCSSUsage) console.log("Trying to append");
            var output = document.createElement('script');
            output.id = "css-usage-tsv-results";
            output.textContent = results;
            output.type = 'text/plain';
            document.querySelector('head').appendChild(output);
            var successfulAppend = checkAppend();
        }

        function checkAppend() {
            if(window.debugCSSUsage) if(window.debugCSSUsage) console.log("Checking append");
            var elem = document.getElementById('css-usage-tsv-results');
            if(elem === null) {
                if(window.debugCSSUsage) console.log("Element not appended");
                if(window.debugCSSUsage) console.log("Trying to append again");
                appendTSV();
            }
            else {
                if(window.debugCSSUsage) console.log("Element successfully found");
            }
        }

    });
}();
