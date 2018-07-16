/* 
    RECIPE: WebP
    -------------------------------------------------------------
    Author: ADYOUN
    Description: Looking for WebP images
*/

function strcmp(a, b)
{
    if (a.length != b.length)
    {
        return false;
    }

    for (var i = 0; i < a.length; i++)
    {
        if (a[i] != b[i])
        {
            return false;
        }
    }

    return true;
}

void function() {
    window.CSSUsage.StyleWalker.recipesToRun.push( function WebP( element, results) {
        if (strcmp(element.nodeName, "IMG") || strcmp(element.nodeName, "SOURCE"))
        {
            var key = "webp";
            var properties = [ "src", "srcset" ];
            var extension = ".webp";

            for (var i = 0; i < properties.length; i++)
            {
                var imgSrc = element[properties[i]];
                if (imgSrc && imgSrc.length > extension.length && strcmp(imgSrc.substr(imgSrc.length - extension.length).toLowerCase(), extension))
                {
                    results[key] = results[key] || { count: 0, };
                    results[key].count++;
                }
            }
        }

        return results;
    });
}();
