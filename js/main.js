//wrap everything in a self-executing anonymous function
(function(){
    
    //variables for data join
    var attrArray = ["total_collisions", "pct_fatal", "pct_serious", "pct_minor","pct_property", "pct_unknown", "Col_per_licDR", "fatal_perLicDr", "serious_injry_perLicDr" ];
    
    //attribute variables
    var attrName = {
        total_collisions: "Total Collisions", 
        pct_fatal: "Percent Fatal", 
        pct_serious: "Percent Serious Injury",
        pct_minor: "Percent Minor Injury",
        pct_property: "Percent Property Damage",
        pct_unknown: "Percent Unknown",
        Col_per_licDR: "Collision Rate",
        fatal_perLicDr: "Fatality Rate",
        serious_injry_perLicDr: "Serious Injury Rate"
    }
    
    var attrDesc = {
        total_collisions: "Total Collisions by County", 
        pct_fatal: "Fatal Collisions (%) by County", 
        pct_serious: "Serious Injury Collisions (%) by County",
        pct_minor: "Minor Injury Collisions (%) by County",
        pct_property: "Property Damage Only (%) by County",
        pct_unknown: "Unknown Injury Collisions (%) by County",
        Col_per_licDR: "Collision Rate per 10,000 licensed drivers",
        fatal_perLicDr: "Fatality Rate per 10,000 licensed drivers",
        serious_injry_perLicDr: "Serious Injury Rate per 10,000 licensed drivers"
    }
    
    
    var expressed = attrArray[6]; //initial attribute
    
    //chart frame dimensions
    var chartWidth = window.innerWidth * 0.425,
        chartHeight = 460, 
        leftPadding = 40,
        rightPadding = 2,
        topBottomPadding = 5,
        chartInnerWidth = chartWidth - leftPadding - rightPadding,
        chartInnerHeight = chartHeight - topBottomPadding * 2,
        translate = "translate(" + leftPadding + "," + topBottomPadding + ")";
        
    //create a scale to size bars proportionally to frame and for axis
    var yScale = d3.scaleLinear()
        .range([chartHeight-11, 0])
        .domain([0, 420]);
    

    //begin script when window loads
    window.onload = setMap();

    //set up cloropleth map
    function setMap(){
    
        //map frame dimensions
        var width = window.innerWidth * 0.5,
            height = 600;
    
        //create new svg container for the map
        var map = d3.select(".mainContainer")
            .append("svg")
            .attr("class", "map")
            .attr("width", width)
            .attr("height", height);
    
        //create Albers equal area conic projection centered on Washington
        var projection = d3.geoAlbers()
            .center([0, 47.25])
            .rotate([121.0, 0, 0])
            .parallels([45.0, 47.0])
            .scale(7000)
            .translate([width / 2, height / 2]);
    
        var path = d3.geoPath()
            .projection(projection);

        //use queue to parallelize asynchronous data loading
        d3.queue()
            .defer(d3.csv, "data/wa_accident_data.csv")//load attributes from csv
            .defer(d3.json, "data/WashingtonCountyBoundaries.topojson")//load choropleth spatial data
            .await(callback);

        function callback(error, csvData, washington){
        
            //translate washington TopoJSON
            var washingtonCounties = topojson.feature(washington, washington.objects.WashingtonCountyBoundaries).features;


            //join csv data to GeoJSON enumeration units
            washingtonCounties = joinData(washingtonCounties, csvData);
            
            //create the color scale
            var colorScale = makeColorScale(csvData);

            //add enumeration units to the map
            setEnumerationUnits(washingtonCounties, map, path, colorScale);          

            console.log(washingtonCounties);
            
            //add coordinated vizualization to the map
            setChart(csvData, colorScale);
            
            //dropdown
            createDropdown(csvData);
        
        }
    };
    
    //function to create color scale generator
    function makeColorScale(data){
        var colorClasses = [
            "#c0dee7",
            "#5ec0df",
            "#4690A7",
            "#2c5866",
            "#0B2F3B"
        ];

        //create color scale generator
        var colorScale = d3.scaleQuantile()
            .range(colorClasses);

        //build array of all values of the expressed attribute
        var domainArray = [];
        for (var i=0; i<data.length; i++){
            var val = parseFloat(data[i][expressed]);
            domainArray.push(val);
        };

        //assign array of expressed values as scale domain
        colorScale.domain(domainArray);

        return colorScale;
    };
    
    //function to test for data value and return color
    function choropleth(props, colorScale){
        //make sure attribute value is a number
        var val = parseFloat(props[expressed]);
        //if attribute value exists, assign a color; otherwise assign gray
        if (typeof val == 'number' && !isNaN(val)){
            return colorScale(val);
        } else {
            return "black";
        };
    };

    function joinData(washingtonCounties, csvData){
        //loop through csv to assign each set of csv attribute values to geojson county
            for (var i=0; i<csvData.length; i++){
                var csvCounty = csvData[i]; //the current county
                var csvKey = csvCounty.JURISDIC; //the CSV primary key

                //loop through geojson counties to find correct county
                for (var a=0; a<washingtonCounties.length; a++){

                    var geojsonProps = washingtonCounties[a].properties; //the current county geojson properties
                    var geojsonKey = geojsonProps.JURISDIC; //the geojson primary key

                    //where primary keys match, transfer csv data to geojson properties object
                    if (geojsonKey == csvKey){

                         //assign all attributes and values
                        attrArray.forEach(function(attr){
                            var val = parseFloat(csvCounty[attr]); //get csv attribute value
                            geojsonProps[attr] = val; //assign attribute and value to geojson properties
                        });
                    };
                };
            };

        return washingtonCounties;
    };
    
    //function to create coordinated bar chart
    function setChart(csvData, colorScale){
        
        //create a second svg element to hold the bar chart
        var chart = d3.select(".mainContainer") 
            .append("svg")
            .attr("width", chartWidth)
            .attr("height", chartHeight)
            .attr("class", "chart");

        //create a rectangle for chart background fill
        var chartBackground = chart.append("rect")
            .attr("class", "chartBackground")
            .attr("width", chartInnerWidth)
            .attr("height", chartInnerHeight)
            .attr("transform", translate);

        //set bars for each county
        var bars = chart.selectAll(".bar")
            .data(csvData)
            .enter()
            .append("rect")
            .sort(function(a, b){
                return b[expressed]-a[expressed]
            })
            .attr("class", function(d){
                return "bar " + d.JURISDIC;
            })
            .attr("width", chartInnerWidth / csvData.length - 1)
            .on("mouseover", highlight)
            .on("mouseout", dehighlight)
            .on("mousemove", moveLabel);
        
        //add style descriptor to each rect
        var desc = bars.append("desc")
            .text('{"stroke": "none", "stroke-width": "0px"}');

        //create a text element for the chart title
        var chartTitle = chart.append("text")
            .attr("x", 100)
            .attr("y", 20)
            .attr("class", "chartTitle")
            

        //create vertical axis generator
        var yAxis = d3.axisLeft()
            .scale(yScale)
            //.orient("left");

        //place axis
        var axis = chart.append("g")
            .attr("class", "axis")
            .attr("transform", translate)
            .call(yAxis);

        //create frame for chart border
        var chartFrame = chart.append("rect")
            .attr("class", "chartFrame")
            .attr("width", chartInnerWidth)
            .attr("height", chartInnerHeight)
            .attr("transform", translate);
        
        //set bar positions, heights, and colors
        updateChart(bars, csvData.length, colorScale);
        
    };
    
    //function to create a dropdown menu for attribute selection
    function createDropdown(csvData){
        //add select element
        var dropdown = d3.select("body")
            .append("select")
            .attr("class", "dropdown")
        .on("change", function(){
            changeAttribute(this.value,csvData)
        });

        //add initial option
        var titleOption = dropdown.append("option")
            .attr("class", "titleOption")
            .attr("disabled", "true")
            .text("Select Attribute");

        //add attribute name options
        var attrOptions = dropdown.selectAll("attrOptions")
            .data(attrArray)
            .enter()
            .append("option")
            .attr("value", function(d){ return d })
            .text(function(d){ return attrName[d]});
    };
    
    //dropdown change listener handler
    function changeAttribute(attribute, csvData){
        //change the expressed attribute
        expressed = attribute;

        //recreate the color scale
        var colorScale = makeColorScale(csvData);

        //recolor enumeration units
        var counties = d3.selectAll(".counties")
            .transition()
            .duration(1000)
            .style("fill", function(d){
                return choropleth(d.properties, colorScale)
            });
        
        //re-sort, resize, and recolor bars
        var bars = d3.selectAll(".bar")
            //re-sort bars
            .sort(function(a, b){
                return b[expressed] - a[expressed];
            })
            .transition()//add animation
            .delay(function(d,i){
                return i*20
            })
            .duration(500);
        
        //get the max value for the selected attribute
        var max = d3.max(csvData, function(d){
            return + parseFloat(d[expressed])
        });
        
        //set reset yScale adjust max for some attributes
        if (expressed == attrArray[0]){
            yScale = d3.scaleLinear()
                .range([chartHeight-11,0])
                .domain([0,max+800]);
        }else{yScale = d3.scaleLinear()
            .range([chartHeight-11, 0])
            .domain([0, Math.ceil(max)]); //return the max domain to the next interger
        }
        
        
        //call updatechart function to change bars, and colors
        updateChart(bars, csvData.length, colorScale);
    };
    
    //function to position, size, and color bars in chart
    function updateChart(bars, n, colorScale){
        
        //position bars
        bars.attr("x", function(d, i){
                return i * (chartInnerWidth / n) + leftPadding;
            })
            //size/resize bars
            .attr("height", function(d, i){
                return 450 - yScale(parseFloat(d[expressed]));
            })
            .attr("y", function(d, i){
                return yScale(parseFloat(d[expressed])) + topBottomPadding;
            })
            //color/recolor bars
            .style("fill", function(d){
                return choropleth(d, colorScale);
            });
        //text to chart title
        var chartTitle = d3.select(".chartTitle")
            .text(attrDesc[expressed]);
        
        //update the chart axis
        var yAxis = d3.axisLeft()
            .scale(yScale)

        d3.selectAll("g.axis")
            .transition().duration(1500)//slow down and anamate the change in the y axis
            .call(yAxis);
    };
    
     //function to highlight enumeration units and bars
    function highlight(props){
        //change stroke
        var selected = d3.selectAll("." + props.JURISDIC)
            .style("stroke", "#f8dc00")
            .style("stroke-width", "2.75");
        setLabel(props);
    };
    
    //function to reset the element style on mouseout
    function dehighlight(props){
        var selected = d3.selectAll("." + props.JURISDIC)
            .style("stroke", function(){
                return getStyle(this, "stroke")
            })
            .style("stroke-width", function(){
                return getStyle(this, "stroke-width")
            });

        function getStyle(element, styleName){
            var styleText = d3.select(element)
                .select("desc")
                .text();

            var styleObject = JSON.parse(styleText);

            return styleObject[styleName];   
        };
        d3.select(".infolabel")
            .remove();
    };

    function setEnumerationUnits(washingtonCounties, map, path, colorScale){
    //add washington counties to map
            var counties = map.selectAll(".counties")
                .data(washingtonCounties)
                .enter()
                .append("path")
                .attr("class", function(d){
                    return "counties " + d.properties.JURISDIC;
                })
                .attr("d", path)
                .style("fill", function(d){
                    return choropleth(d.properties,colorScale);
                })
                .on("mouseover", function(d){
                    highlight(d.properties);
                })
                .on("mouseout", function(d){
                    dehighlight(d.properties);
                })
                .on("mousemove", moveLabel);
        
            //add style descriptor to each path
            var desc = counties.append("desc")
                .text('{"stroke": "#000", "stroke-width": "0.5px"}');

            //examine the reults
            //console.log(washingtonCounties);

            //console.log(error);
            //console.log(csvData);
            //console.log(washington);
    };
    
    //function to create dynamic label
    function setLabel(props){
        //label content
        if (props[expressed]>0){
        var labelAttribute = "<h2>" + props[expressed] +
            "</h2><br><b>" + attrName[expressed] + "</b>";
        }else{
            var labelAttribute = "<h2>"+"No Data"+"</h2><br><b>"+attrName[expressed]+"</b>";
        };

        //create info label div
        var infolabel = d3.select("body")
            .append("div")
            .attr("class", "infolabel")
            .attr("id", props.JURISDIC + "_label")
            .html(labelAttribute);

        var countyName = infolabel.append("div")
            .attr("class", "labelname")
            .html(props.JURISDIC_2);
         console.log(countyName);
    };
   
    //function to move info label with mouse
    function moveLabel(){
        //get width of label
        var labelWidth = d3.select(".infolabel")
            .node()
            .getBoundingClientRect()
            .width;
        
        //use coordinates of mousemove event to set label coordinates
        var x1 = d3.event.clientX + 10,
            y1 = d3.event.clientY - 85,
            x2 = d3.event.clientX-labelWidth-10,
            y2 = d3.event.clientY + 25;
        
        //horizontal label coordinate, testing for overflow
        var x = d3.event.clientX > window.innerWidth - labelWidth - 20 ? x2 : x1; 
        //vertical label coordinate, testing for overflow
        var y = d3.event.clientY < 75 ? y2 : y1;

        d3.select(".infolabel")
            .style("left", x + "px")
            .style("top", y + "px");
    };
    
})();