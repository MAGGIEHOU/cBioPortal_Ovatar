/*
 * Copyright (c) 2012 Memorial Sloan-Kettering Cancer Center.
 * This library is free software; you can redistribute it and/or modify it
 * under the terms of the GNU Lesser General Public License as published
 * by the Free Software Foundation; either version 2.1 of the License, or
 * any later version.
 *
 * This library is distributed in the hope that it will be useful, but
 * WITHOUT ANY WARRANTY, WITHOUT EVEN THE IMPLIED WARRANTY OF
 * MERCHANTABILITY OR FITNESS FOR A PARTICULAR PURPOSE.  The software and
 * documentation provided hereunder is on an "as is" basis, and
 * Memorial Sloan-Kettering Cancer Center
 * has no obligations to provide maintenance, support,
 * updates, enhancements or modifications.  In no event shall
 * Memorial Sloan-Kettering Cancer Center
 * be liable to any party for direct, indirect, special,
 * incidental or consequential damages, including lost profits, arising
 * out of the use of this software and its documentation, even if
 * Memorial Sloan-Kettering Cancer Center
 * has been advised of the possibility of such damage.  See
 * the GNU Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with this library; if not, write to the Free Software Foundation,
 * Inc., 59 Temple Place, Suite 330, Boston, MA 02111-1307 USA.
 */

/****************************************************************************************************
 * Creating overall survival and disease free curves for the survival tab
 * @author Yichao Sun
 * @date Sep 2013
 *
 * This code performs the following functions:
 * 1. Calculate the survival rates for each time point using kaplan-meier estimator
 * 2. Generate the curves using d3 line charts w/ mouse over for each time point
 * 3. Display basic information of main query: gene set, nubmer of cases
 * 4. Calculate interested values from the curve: p-value(log-rank test), median, 0.95lcl, 0.95ucl
 *
 ****************************************************************************************************/

var survivalCurves = (function() {

    var util = (function() {

        function sortByAttribute(objs, attrName) {
            function compare(a,b) {
                if (a[attrName] < b[attrName])
                    return -1;
                if (a[attrName] > b[attrName])
                    return 1;
                return 0;
            }
            objs.sort(compare);
            return objs;
        }

        return {
            sortByAttribute: sortByAttribute
        }

    }());

    var data  = (function() {

        var datum = {
                case_id: "",
                time: "",    //num of months
                status: "", //os: DECEASED-->1, LIVING-->0; dfs: Recurred/Progressed --> 1, Disease Free-->0
                num_at_risk: -1,
                survival_rate: 0
            },
            os_altered_group = [],
            os_unaltered_group = [],
            dfs_altered_group = [],
            dfs_unaltered_group = [];

        var totalAlter = 0,
            totalUnalter = 0;

        //Count the total number of altered and unaltered cases
        function cntAlter(caseLists) {
            for (var key in caseLists) {
                if (caseLists[key] === "altered") totalAlter += 1;
                else if (caseLists[key] === "unaltered") totalUnalter += 1;
            }
        }

        //Settle the overall survival datum group
        //order by time, filtered NA cases and add on num of risk for each time point
        function setOSGroups(result, caseLists) {
            var _totalAlter = 0,
                _totalUnalter = 0;
            for (var caseId in result) {
                if (result.hasOwnProperty(caseId) && (result[caseId] !== "")) {
                    var _datum = jQuery.extend(true, {}, datum);
                    _datum.case_id = result[caseId].case_id;
                    _datum.time = result[caseId].os_months;
                    _datum.status = result[caseId].os_status;
                    if (_datum.time !== "NA") {
                        if (caseLists[caseId] === "altered") {
                            os_altered_group.push(_datum);
                            _totalAlter += 1;
                        } else if (caseLists[caseId] === "unaltered") {
                            os_unaltered_group.push(_datum);
                            _totalUnalter += 1;
                        }
                    }
                }
            }
            util.sortByAttribute(os_altered_group, "time");
            util.sortByAttribute(os_unaltered_group, "time");

            for (var i in os_altered_group) {
                os_altered_group[i].num_at_risk = _totalAlter;
                _totalAlter += -1;
            }
            for (var i in os_unaltered_group) {
                os_unaltered_group[i].num_at_risk = _totalUnalter;
                _totalUnalter += -1;
            }
        }

        //Settle the disease free survival datum group
        //order by time, filtered NA cases and add on num of risk for each time point
        function setDFSGroups(result, caseLists) {
            var _totalAlter = 0,
                _totalUnalter = 0;
            for (var caseId in result) {
                if (result.hasOwnProperty(caseId) && (result[caseId] !== "")) {
                    var _datum = jQuery.extend(true, {}, datum);
                    _datum.case_id = result[caseId].case_id;
                    _datum.time = result[caseId].dfs_months;
                    _datum.status = result[caseId].dfs_status;
                    if (_datum.time !== "NA") {
                        if (caseLists[caseId] === "altered") {
                            dfs_altered_group.push(_datum);
                            _totalAlter += 1;
                        } else if (caseLists[caseId] === "unaltered") {
                            dfs_unaltered_group.push(_datum);
                            _totalUnalter += 1;
                        }
                    }
                }
            }

            util.sortByAttribute(dfs_altered_group, "time");
            util.sortByAttribute(dfs_unaltered_group, "time");

            for (var i in dfs_altered_group) {
                dfs_altered_group[i].num_at_risk = _totalAlter;
                _totalAlter += -1;
            }
            for (var i in dfs_unaltered_group) {
                dfs_unaltered_group[i].num_at_risk = _totalUnalter;
                _totalUnalter += -1;
            }
        }

        return {
            init: function(result, caseLists) {
                cntAlter(caseLists);
                setOSGroups(result, caseLists);
                setDFSGroups(result, caseLists);
                kmEstimator.calc(os_altered_group);
                kmEstimator.calc(os_unaltered_group);
                kmEstimator.calc(dfs_altered_group);
                kmEstimator.calc(dfs_unaltered_group);
            },
            getOSAlteredData: function() {
                return os_altered_group;
            },
            getOSUnalteredData: function() {
                return os_unaltered_group;
            },
            getDFSAlteredData: function() {
                return dfs_altered_group;
            },
            getDFSUnalteredData: function() {
                return dfs_unaltered_group;
            }
        }
    }());

    var view = (function() {
        var elem = {
                svgOS : "",
                svgDFS: "",
                xScale : "",
                yScale : "",
                xAxisOS : "",
                yAxisOS : "",
                xAxisDFS : "",
                yAxisDFS : "",
                line: "",
                osAlterDots: "",
                osUnalterDots: "",
                dfsAlterDots: "",
                dfsUnalterDots: "",
                osAlterCensoredDots: "",
                osUnalterCensoredDots: "",
                dfsAlterCensoredDots: "",
                dfsUnalterCensoredDots: ""
            },
            settings = {
                canvas_width: 1000,
                canvas_height: 650,
                altered_line_color: "red",
                unaltered_line_color: "blue",
                altered_mouseover_color: "#F5BCA9",
                unaltered_mouseover_color: "#81BEF7"
            },
            text = {
                glyph1: "Gene Set Not Altered",
                glyph2: "Gene Set Altered",
                xTitle_os: "Months Survival",
                yTitle_os: "Surviving",
                xTitle_dfs: "Months Disease Free",
                yTitle_dfs: "Disease Free"
            },
            style = {
                censored_sign_size: 5
            }

        function initCanvas() {
            $('#os_survival_curve').empty();
            $('#dfs_survival_curve').empty();
            elem.svgOS = d3.select("#os_survival_curve")
                .append("svg")
                .attr("width", settings.canvas_width)
                .attr("height", settings.canvas_height);
            elem.svgDFS = d3.select("#dfs_survival_curve")
                .append("svg")
                .attr("width", settings.canvas_width)
                .attr("height", settings.canvas_height);
            elem.osAlterDots = elem.svgOS.append("g");
            elem.osUnalterDots = elem.svgOS.append("g");
            elem.dfsAlterDots = elem.svgDFS.append("g");
            elem.dfsUnalterDots = elem.svgDFS.append("g");
            elem.osAlterCensoredDots = elem.svgOS.append("g");
            elem.osUnalterCensoredDots = elem.svgOS.append("g");
            elem.dfsAlterCensoredDots = elem.svgDFS.append("g");
            elem.dfsUnalterCensoredDots = elem.svgDFS.append("g");
        }

        function initAxis() {
            var _dataset = [];
            var formatAsPercentage = d3.format(".1%");
            _dataset.push(d3.max(data.getOSAlteredData(), function(d) { return d.time; }));
            _dataset.push(d3.max(data.getOSUnalteredData(), function(d) { return d.time; }));
            _dataset.push(d3.max(data.getDFSAlteredData(), function(d) { return d.time; }));
            _dataset.push(d3.max(data.getDFSUnalteredData(), function(d) { return d.time; }));
            elem.xScale = d3.scale.linear()
                .domain([0, d3.max(_dataset) + 0.1 * d3.max(_dataset)])
                .range([100, 600]);
            elem.yScale = d3.scale.linear()
                .domain([-0.03, 1.05]) //fixed to be 0-1
                .range([550, 50]);
            elem.xAxisOS = d3.svg.axis()
                .scale(elem.xScale)
                .orient("bottom");
            elem.yAxisOS = d3.svg.axis()
                .scale(elem.yScale)
                .tickFormat(formatAsPercentage)
                .orient("left");
            elem.xAxisDFS = d3.svg.axis()
                .scale(elem.xScale)
                .orient("bottom");
            elem.yAxisDFS = d3.svg.axis()
                .scale(elem.yScale)
                .tickFormat(formatAsPercentage)
                .orient("left");
        }

        function initLines() {
            elem.line = d3.svg.line()
                .interpolate("step-after")
                .x(function(d) { return elem.xScale(d.time); })
                .y(function(d) { return elem.yScale(d.survival_rate); });
        }

        function drawLines() {
            elem.svgOS.append("path")
                .attr("d", elem.line(data.getOSAlteredData()))
                .style("fill", "none")
                .style("stroke", settings.altered_line_color);
            elem.svgOS.append("path")
                .attr("d", elem.line(data.getOSUnalteredData()))
                .style("fill", "none")
                .style("stroke", settings.unaltered_line_color);
            elem.svgDFS.append("path")
                .attr("d", elem.line(data.getDFSAlteredData()))
                .style("fill", "none")
                .style("stroke", settings.altered_line_color);
            elem.svgDFS.append("path")
                .attr("d", elem.line(data.getDFSUnalteredData()))
                .style("fill", "none")
                .style("stroke", settings.unaltered_line_color);
        }

        function drawInvisiableDots(svg, color, data) {
            svg.selectAll("path")
                .data(data)
                .enter()
                .append("svg:path")
                .attr("d", d3.svg.symbol()
                    .size(400)
                    .type("circle"))
                .attr("transform", function(d){
                    return "translate(" + elem.xScale(d.time) + ", " + elem.yScale(d.survival_rate) + ")";
                })
                .attr("fill", color)
                .style("opacity", 0);
        }

        function addQtips(svg) {
            svg.selectAll('path').each(
                function(d) {
                    var content = "<font size='2'>";
                    content += "Case ID: " + "<strong><a href='tumormap.do?case_id=" + d.case_id +
                        "&cancer_study_id=" + cancer_study_id + "' target='_blank'>" + d.case_id + "</a></strong><br>";
                    content += "OBS Time: <strong>" + d.time + "</strong><br>";
                    content += "KM Est: <strong>" + (d.survival_rate * 100).toFixed(3) + "%</strong><br>";
                    if (d.status === "0") { // If censored, mark it
                        content += "<strong> -- Censored -- </strong>";
                    }
                    content += "</font>";

                    $(this).qtip(
                        {
                            content: {text: content},
                            style: { classes: 'ui-tooltip-light ui-tooltip-rounded ui-tooltip-shadow ui-tooltip-lightyellow' },
                            show: {event: "mouseover"},
                            hide: {fixed:true, delay: 100, event: "mouseout"},
                            position: {my:'left bottom',at:'top right'}
                        }
                    );

                    var mouseOn = function() {
                        var dot = d3.select(this);
                        dot.transition()
                            .duration(400)
                            .style("opacity", .9);
                    };

                    var mouseOff = function() {
                        var dot = d3.select(this);
                        dot.transition()
                            .duration(400)
                            .style("opacity", 0);
                    };

                    svg.selectAll("path").on("mouseover", mouseOn);
                    svg.selectAll("path").on("mouseout", mouseOff);
                }
            );
        }

        function appendAxis(svg, elemAxisX, elemAxisY) {
            svg.append("g")
                .style("stroke-width", 2)
                .style("fill", "none")
                .style("stroke", "grey")
                .style("shape-rendering", "crispEdges")
                .attr("transform", "translate(0, 550)")
                .call(elemAxisX);
            svg.append("g")
                .style("stroke-width", 2)
                .style("fill", "none")
                .style("stroke", "grey")
                .style("shape-rendering", "crispEdges")
                .attr("transform", "translate(0, 50)")
                .call(elemAxisX.orient("bottom").ticks(0));
            svg.append("g")
                .style("stroke-width", 2)
                .style("fill", "none")
                .style("stroke", "grey")
                .style("shape-rendering", "crispEdges")
                .attr("transform", "translate(100, 0)")
                .call(elemAxisY);
            svg.append("g")
                .style("stroke-width", 2)
                .style("fill", "none")
                .style("stroke", "grey")
                .style("shape-rendering", "crispEdges")
                .attr("transform", "translate(600, 0)")
                .call(elemAxisY.orient("left").ticks(0));
            svg.selectAll("text")
                .style("font-family", "sans-serif")
                .style("font-size", "11px")
                .style("stroke-width", 0.5)
                .style("stroke", "black")
                .style("fill", "black");

        }

        function drawCensoredDots(svg, data, color) {
            svg.selectAll("path")
                .data(data)
                .enter()
                .append("line")
                .attr("x1", function(d) {return elem.xScale(d.time)})
                .attr("x2", function(d) {return elem.xScale(d.time)})
                .attr("y1", function(d) {return elem.yScale(d.survival_rate) + style.censored_sign_size})
                .attr("y2", function(d) {return elem.yScale(d.survival_rate) - style.censored_sign_size})
                .attr("stroke", color)
                .style("opacity", function(d) {
                    if (d.status === "1") {
                        return 0; //hidden
                    } else if (d.status === "0") { //censored
                        return 1;
                    }
                });
            svg.selectAll("path")
                .data(data)
                .enter()
                .append("line")
                .attr("x1", function(d) {return elem.xScale(d.time) + style.censored_sign_size})
                .attr("x2", function(d) {return elem.xScale(d.time) - style.censored_sign_size})
                .attr("y1", function(d) {return elem.yScale(d.survival_rate)})
                .attr("y2", function(d) {return elem.yScale(d.survival_rate)})
                .attr("stroke", color)
                .style("opacity", function(d) {
                    if (d.status === "1") {
                        return 0; //hidden
                    } else if (d.status === "0") { //censored
                        return 1;
                    }
                });
        }

        function addLegends(svg) {
            var _legends_text = [
                {
                    text: text.glyph1,                //altered
                    color: settings.altered_line_color
                },
                {
                    text: text.glyph2,
                    color: settings.unaltered_line_color
                }
            ];

            var legend = svg.selectAll(".legend")
                .data(_legends_text)
                .enter().append("g")
                .attr("class", "legend")
                .attr("transform", function(d, i) {
                    return "translate(610, " + (80 + i * 15) + ")";
                })

            legend.append("path")
                .attr("width", 18)
                .attr("height", 18)
                .attr("d", d3.svg.symbol()
                    .size(60)
                    .type(function(d) { return "square"; }))
                .attr("fill", function (d) { return d.color; })
                .attr("stroke", "black")
                .attr("stroke-width",.9);

            legend.append("text")
                .attr("dx", ".75em")
                .attr("dy", ".35em")
                .style("text-anchor", "front")
                .text(function(d) { return d.text });
        }

        function appendPval(inputGrp1, inputGrp2, type) {
            logRankTest.calc(inputGrp1, inputGrp2, type);
        }

        function appendpVal_callback(data, svg) {
            svg.append("text")
                .attr("x", 605)
                .attr("y", 140)
                .text("Logrank Test P-Value: " + data);
        }

        function appendAxisTitles(svg, xTitle, yTitle) {
            svg.append("text")
                .attr("class", "label")
                .attr("x", 350)
                .attr("y", 600)
                .style("text-anchor", "middle")
                .style("font-weight","bold")
                .text(xTitle);
            svg.append("text")
                .attr("class", "label")
                .attr("transform", "rotate(-90)")
                .attr("x", -270)
                .attr("y", 45)
                .style("text-anchor", "middle")
                .style("font-weight","bold")
                .text(yTitle);
        }

        return {
            init: function() {
                initCanvas();
                initAxis();
                initLines();
            },
            generate: function() {
                drawLines(); //draw all four curves together
                //overlay invisible dots for mouseover purpose
                drawInvisiableDots(elem.osAlterDots, settings.altered_mouseover_color, data.getOSAlteredData());
                drawInvisiableDots(elem.osUnalterDots, settings.unaltered_mouseover_color, data.getOSUnalteredData());
                drawInvisiableDots(elem.dfsAlterDots, settings.altered_mouseover_color, data.getDFSAlteredData());
                drawInvisiableDots(elem.dfsUnalterDots, settings.unaltered_mouseover_color, data.getDFSUnalteredData());
                //overlay censored data (as a plus sign)
                drawCensoredDots(elem.osAlterCensoredDots, data.getOSAlteredData(), settings.altered_line_color);
                drawCensoredDots(elem.osUnalterCensoredDots, data.getOSUnalteredData(), settings.unaltered_line_color);
                drawCensoredDots(elem.dfsAlterCensoredDots, data.getDFSAlteredData(), settings.altered_line_color);
                drawCensoredDots(elem.dfsUnalterCensoredDots, data.getDFSUnalteredData(), settings.unaltered_line_color);
                //Add mouseover
                addQtips(elem.osAlterDots);
                addQtips(elem.osUnalterDots);
                addQtips(elem.dfsAlterDots);
                addQtips(elem.dfsUnalterDots);
                //Append Axis
                appendAxis(elem.svgDFS, elem.xAxisOS, elem.yAxisOS);
                appendAxis(elem.svgOS, elem.xAxisDFS, elem.yAxisDFS);
                //append Axis titles
                appendAxisTitles(elem.svgOS, text.xTitle_os, text.yTitle_os);
                appendAxisTitles(elem.svgDFS, text.xTitle_dfs, text.yTitle_dfs);
                //Append Glyphes
                addLegends(elem.svgOS);
                addLegends(elem.svgDFS);
                //AppendValues
                appendPval(data.getOSAlteredData(), data.getOSUnalteredData(), elem.svgOS);
                appendPval(data.getDFSAlteredData(), data.getDFSUnalteredData(), elem.svgDFS);
            },
            appendpVal_callback: appendpVal_callback
        }
    }());

    var kmEstimator = (function() {

        return {
            calc: function(inputGrp) { //calculate the survival rate for each time point
                //each item in the input already has fields: time, num at risk, event/status(0-->censored)
                var _prev_value = 1;  //buffer for the previous value
                for (var i in inputGrp) {
                    var _case = inputGrp[i];
                    if (_case.status === "1") {
                        _case.survival_rate = _prev_value * ((_case.num_at_risk - 1) / _case.num_at_risk) ;
                        _prev_value = _case.survival_rate;
                    } else if (_case.status === "0") {
                        _case.survival_rate = _prev_value; //survival rate remain the same if the event is "censored"
                    } else {
                        //TODO: error handling
                    }
                }
            }
        }
    }());

    //Calculate the p-value between two curves from log-rank test
    var logRankTest = (function() {

        var datum = {
                time: "",    //num of months
                num_of_failure_1: 0,
                num_of_failure_2: 0,
                num_at_risk_1: 0,
                num_at_risk_2: 0,
                expectation: 0, //(n1j / (n1j + n2j)) * (m1j + m2j)
                variance: 0
            },
            mergedArr = [];
                                                  //os: DECEASED-->1, LIVING-->0; dfs: Recurred/Progressed --> 1, Disease Free-->0
        function mergeGrps(inputGrp1, inputGrp2) {
            var _ptr_1 = 0; //index indicator/pointer for group1
            var _ptr_2 = 0; //index indicator/pointer for group2

            while(_ptr_1 < inputGrp1.length && _ptr_2 < inputGrp2.length) { //Stop when either pointer reach the end of the array
                if (inputGrp1[_ptr_1].time < inputGrp2[_ptr_2].time) {
                    var _datum = jQuery.extend(true, {}, datum);
                    _datum.time = inputGrp1[_ptr_1].time;
                    if (inputGrp1[_ptr_1].status === "1") {
                        _datum.num_of_failure_1 = 1;
                        _datum.num_at_risk_1 = inputGrp1[_ptr_1].num_at_risk;
                        _datum.num_at_risk_2 = inputGrp2[_ptr_2].num_at_risk;
                        _ptr_1 += 1;
                    } else {
                        _ptr_1 += 1;
                        continue;
                    }
                } else if (inputGrp1[_ptr_1].time > inputGrp2[_ptr_2].time) {
                    var _datum = jQuery.extend(true, {}, datum);
                    _datum.time = inputGrp2[_ptr_2].time;
                    if (inputGrp2[_ptr_2].status === "1") {
                        _datum.num_of_failure_2 = 1;
                        _datum.num_at_risk_1 = inputGrp1[_ptr_1].num_at_risk;
                        _datum.num_at_risk_2 = inputGrp2[_ptr_2].num_at_risk;
                        _ptr_2 += 1;
                    } else {
                        _ptr_2 += 1;
                        continue;
                    }
                } else { //events occur at the same time point
                    var _datum = jQuery.extend(true, {}, datum);
                    _datum.time = inputGrp1[_ptr_1].time;
                    if (inputGrp1[_ptr_1].status === "1" || inputGrp2[_ptr_2].status === "1") {
                        if (inputGrp1[_ptr_1].status === "1") {
                            _datum.num_of_failure_1 = 1;
                        }
                        if (inputGrp2[_ptr_2].status === "1") {
                            _datum.num_of_failure_2 = 1;
                        }
                        _datum.num_at_risk_1 = inputGrp1[_ptr_1].num_at_risk;
                        _datum.num_at_risk_2 = inputGrp2[_ptr_2].num_at_risk;
                        _ptr_1 += 1;
                        _ptr_2 += 1;
                    } else {
                        _ptr_1 += 1;
                        _ptr_2 += 1;
                        continue;
                    }
                }
                mergedArr.push(_datum);
            }
        }

        function calcExpection() {
            for (var i in mergedArr) {
                var _item = mergedArr[i];
                _item.expectation = (_item.num_at_risk_1 / (_item.num_at_risk_1 + _item.num_at_risk_2)) * (_item.num_of_failure_1 + _item.num_of_failure_2);
            }
        }

        function calcVariance() {
            for (var i in mergedArr) {
                var _item = mergedArr[i];
                var _num_of_failures = _item.num_of_failure_1 + _item.num_of_failure_2;
                var _num_at_risk = _item.num_at_risk_1 + _item.num_at_risk_2;
                _item.variance = ( _num_of_failures * (_num_at_risk - _num_of_failures) * _item.num_at_risk_1 * _item.num_at_risk_2) / ((_num_at_risk * _num_at_risk) * (_num_at_risk - 1));
            }
        }

        function calcPval(svg) {
            var O1 = 0, E1 = 0, V = 0;
            for (var i in mergedArr) {
                var _item = mergedArr[i];
                O1 += _item.num_of_failure_1;
                E1 += _item.expectation;
                V += _item.variance;
            }
            var chi_square_score = (O1 - E1) * (O1 - E1) / V;
            $.post( "calcPval.do", { chi_square_score: chi_square_score })
                .done(function( data ) {
                    view.appendpVal_callback(data, svg);
                });
        }

        return {
            calc: function(inputGrp1, inputGrp2, svg) {
                mergedArr.length = 0;
                mergeGrps(inputGrp1, inputGrp2);
                calcExpection();
                calcVariance();
                calcPval(svg);
            }
        }
    }());

    return {
        init: function(caseLists) {
            var paramsGetSurvivalData = {
                case_set_id: case_set_id,
                case_ids_key: case_ids_key,
                cancer_study_id: cancer_study_id
            };
            $.post("getSurvivalData.json", paramsGetSurvivalData, getResultInit(caseLists), "json");

            function getResultInit(caseLists) {
                return function(result) {
                    data.init(result, caseLists);
                    view.init();
                    view.generate();
                }
            }
        }
    }
}());