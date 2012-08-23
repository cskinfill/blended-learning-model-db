var colNumLookup = {};
var aoColumns; // global is terrible but need this for fnCreatedRow for now
var datatable;
var sliderMin, sliderMax;

/*
 * Initialize the data table with all data, options, and extensions configured.
 */
function init_table() {
  
  var options = fnGetColumnsAndData();
  options['sErrMode'] = 'throw';

  // Remove the option to choose a pagination length
  options['iDisplayLength'] = 10;
  options['sDom'] = 'tpi'; // this is the default minus "l"ength
  options['bAutoWidth'] = false;

  options['fnDrawCallback'] = fnDrawCallback;
  options['fnCreatedRow'] = fnCreatedRow;

  $.fn.dataTableExt.afnFiltering.push(fnFilterSelects);
  $.fn.dataTableExt.afnFiltering.push(fnFilterGradesServed);
  

  $('#gradesserved > div').slider({
      range: true,
        min: -1,
        max: 12,
        values: [-1, 12],
        slide: onSliderChange});

  // create and draw the table
  datatable = $('#models').dataTable(options);
}

/*
 * Populates the text of the grades served slider,
 * and adjust the filter accordingly.
 */
function onSliderChange(event, ui) {
  // update the text of display

  function gradeNumberToString(numeric_grade) {
    if (numeric_grade === -1) {
      return "PreK";
    } else if (numeric_grade === 0) {
      return "K";
    } else {
      return numeric_grade;
    }
  }

  sliderMin = ui.values[0];
  sliderMax = ui.values[1];
 
  var min = gradeNumberToString(sliderMin);
  var max = gradeNumberToString(sliderMax);
  text = (min == max) ? min : min + ' - ' + max;
  $('#gradesserved > span').text(text);
  
  // update the results
  setTimeout(function() {
      datatable.fnDraw();
    },0);
}

/*
 * This method defines the columns and attributes, and converts
 * the data in innosight.json into a format that DataTable expects.
 * 
 * Returns an object with keys aoColumns and aaData.
 */
function fnGetColumnsAndData() {
  var data = [];

  aoColumns =
    [{input: 'title',             sTitle: 'name', bFilterable: true, bSplitOnComma: false, sWidth: '250px'},
     {input: 'detail',            sTitle: 'detail'},
     {input: 'url',               sTitle: 'URL'},
     {input: 'hqstate',           sTitle: 'state', bFilterable: true, sWidth: '100px'},
     {input: 'type',              sTitle: 'type', bFilterable: true, bSplitOnComma: true},
     {input: 'focus',             sTitle: 'focus', bFilterable: true, bSplitOnComma: true},
     {input: 'firstyear',         sTitle: 'first year of operation', bFilterable: true, bSplitOnComma: true},
     {input: 'blendedsubjects',   sTitle: 'blended subjects', bFilterable: true, bSplitOnComma: true},
     {input: 'programmodels',     sTitle: 'blended-learning model', bFilterable: true, bSplitOnComma: true},
     {input: 'postdate',          sTitle: 'date posted', 'sType': 'date'},
     {input: 'hqcity',            sTitle: 'city'},
     {input: 'gradesserved',      sTitle: 'grades served'},
     {input: 'frl',               sTitle: '% Free or Reduced Lunch', 'sType': 'formatted-num'},
     {input: 'minority',          sTitle: '% Black/ or Hispanic', 'sType': 'formatted-num'},
     {input: 'revenueperpupil',   sTitle: 'revenue per pupil', 'sType': 'formatted-num'},
     {input: 'blendedgrades',     sTitle: 'blended grades'},
     {input: 'blendedenrollment', sTitle: 'blended enrollment', 'sType': 'formatted-num'},
     {input: 'content',           sTitle: 'Content'},
     {input: 'sis',               sTitle: 'Student Information System'},
     {input: 'othertools',        sTitle: 'Other Tools'},
     {input: 'indylms',           sTitle: 'Independent LMS'},
     {input: 'indygradebook',     sTitle: 'Independent Gradebook Grades'},
     {input: 'indyassessment',    sTitle: 'Independent Assessment'},
     {input: 'profdevel',         sTitle: 'Professional Development'},
     {input: 'alltools',          sTitle: 'edtech tools', bFilterable: true, bSplitOnComma:true}
     ];

  // DataTable depends on ordered columns, but we want to have the flexibility to refer
  // to particular columns without worrying about their position, so we generate a reverse map
  // from column name to its index
  for (var i = 0; i < aoColumns.length; ++i) {
    colNumLookup[aoColumns[i].input] = i;
  }

  for (var i = 0; i < table_data.length; ++i) {
    var model = table_data[i];
    
    var data_row = aoColumns.map(function(col) {
        var t = model[col.input] ? model[col.input] : '';
        t = t.replace(/K12, Inc/, "K12 Inc"); // normalize weird input
        return t;
      });

    // aggregate all the tools fields into their own uber-list
    // ideally, this would be already done in the JSON file (probably via map/reduce)
    // but I don't have that working yet, so we do some custom stuff here
    var alltools = [];
    for (var field in {'content':1, 'sis':1, 'othertools':1, 'indylms':1, 'indygradebook':1, 'indyassessment':1, 'profdevel':1}) {
      alltools.push(data_row[colNumLookup[field]].split(/ *, */));
    }
    data_row[colNumLookup['alltools']] = alltools.join(', ');

    data.push(data_row);
  }

  return {
    aoColumns: aoColumns,
    aaData: data
  };
}

/*
 * Automatically invoked every time the table is drawn - both on first draw
 * as well as in response to filters.
 */
function fnDrawCallback(oSettings) {
  var data = this.fnGetFilteredData();
  
  // convert the data into an array of meaningful points
  var location_data = 
    this.fnGetFilteredData().map(function(row) {
        // these hard-coded column indices sucks
        return { 
          location: row[colNumLookup['hqcity']] + ',' + row[colNumLookup['hqstate']], // city,state - precisely
          title: row[0]
        };
      });
    
  // defer execution until current call stack is out, to give time
  // for the map to be created
  setTimeout(function () {
      plot_points(location_data);
    },0);
}

/*
 * This is called after each row is rendered. Basically, we trash the existing
 * columns and custom render a new row more conducive to a list-view.
 * CSS is used to hide the remaining columns.
 */
function fnCreatedRow( nRow, aData, iDataIndex ) {
  // private helper function to avoid hard-coding column indices
  function v(field) {
    return aData[colNumLookup[field]];
  }

  var html = [];

  // title
  html.push('<div class="model_row">');
  
  // location
  html.push('<span class="location">' + v('hqcity') + ', ' + v('hqstate') + '</span>');

  html.push('<h2>' +
            '<a href="' + v('url') + '" target="_top">' + v('title') + '</a>' +
            '</h2>');

  html.push('<span class="grades"> Grades ' + v('gradesserved') + '</span>');

  html.push('<span class="model">' + v('programmodels') + '</span>');


  html.push('</div>');

  // set it just to the first td in the row
  $('td:eq(0)', nRow).empty().html(html.join(''));
}

/*
 * Populate and setup the columns that can be filtered.
 */
function initFilteredColumn(oSettings, iColumn, bSplitOnComma) {
  if (!oSettings.aoColumns[iColumn].filterSelect) {

    var deDupedOptions = {};
    for (var iRow = 0; iRow < oSettings.aoData.length; ++iRow) {
      var value = oSettings.aoData[iRow]._aData[iColumn];

      // some columns, like the title, don't need to split on comma
      var values = bSplitOnComma ? value.split(/ *, */) : [value];

      for (var i = 0; i < values.length; ++i) {
        // normalize - remove whitespace and lowercase
        var value = values[i].trim();
        key = value.replace(/^\s+|\s+$/g,"").toLowerCase();
        deDupedOptions[key] = {value: value, 
                               key: key};
      }
    }
    var options = [];
    for (var key in deDupedOptions) {
      options.push(deDupedOptions[key]);
    }
    options.sort(function(a, b) {
        return a.value > b.value ? 1 : ( a.value === b.value ? 0 : -1 );
    });
    
    var colNameVar = oSettings.aoColumns[iColumn]['input'].replace(' ', '_').toLowerCase();

    var select = $('#filtered_' + colNameVar);
    // If there is no select, then create one - else use existing
    if (select.length == 0) {
      console.error('Could not find #filtered_' + colNameVar + ', creating');
      select = $('<select multiple="multiple" />');
      var container = $('<div class="ui-multiselect"/>');
      container.append(select);
      $(oSettings.aoColumns[iColumn].nTh).append(container);
    }

    for (var i = 0 ; i < options.length; ++i) {
      select.append(new Option(options[i].value, options[i].key));
    }

    // register redrawing
    select.change(function() { oSettings.oInstance.fnDraw(); });
 
    // styling and behavior for the multiselect plugin
    select.select2({
        placeholder: 'Select ' + oSettings.aoColumns[iColumn]['sTitle'] + ' ...',
          width: "100%",
          containerCssClass: "select2-custom"
          });

    // This tells the filter which select to use
    oSettings.aoColumns[iColumn].filterSelect = select;
  }
}

/*
 * Perform filtering for all rows marked as bFilterable. This applies
 * only for the <select> dropdowns.
 */
function fnFilterSelects (oSettings, aData, iDataIndex) {
  for (var iColumn = 0; iColumn < oSettings.aoColumns.length; ++iColumn) {
    // check to see if the column supports this
    columnSettings = oSettings.aoColumns[iColumn];
    
    if (!columnSettings.bFilterable) {
      continue;
    }
    
    initFilteredColumn(oSettings, iColumn, columnSettings.bSplitOnComma);
    
    // pull the dropdown reference from the config
    var options = oSettings.aoColumns[iColumn].filterSelect[0].options;
    
    // get an object with keys for each comma-delimited element here
    // n^2 algo but each one should be really small so no big deal
    var potential_matches = columnSettings.bSplitOnComma ? aData[iColumn].split(',') : [aData[iColumn]];
    
    var passedThisRound = true;
    for (var i = 0; i < options.length; ++i) {
      if (options[i].selected) {
        passedThisRound = false;
        // now look through all the objects in split
        for (var j = 0; j < potential_matches.length; ++j) {
          if (potential_matches[j].toLowerCase().indexOf(options[i].value) != -1) {
            passedThisRound = true;
            break;
          }
        }
        if (passedThisRound) {
          break;
        }
      }
    }
    if (passedThisRound) {
      continue;
    } else {
      return false;
    }
  }
  return true;
}

/*
 * Grades served uses a slider, not a dropdown. This is a custom
 * filtering function just for that value.
 */
function fnFilterGradesServed (oSettings, aData, iDataIndex) {

  function gradeStringToNumber(string_grade) {
    if (string_grade === 'PreK') {
      return -1;
    } else if (string_grade === "K") {
      return 0;
    } else {
      return parseInt(string_grade);
    }
  }

  // first, check if the slider is set to anything other than
  // fully open

  if ((!sliderMin && !sliderMax) ||
      sliderMin == -1 && sliderMax == 12) {
    return true; // all pass automatically when it's fully expanded
  }

  // otherwise, let's do the check

  var gradesserved_raw = aData[colNumLookup['blendedgrades']];

  // convert the raw into numeric list, and compare with the
  // values in the slider

  var matches = gradesserved_raw.match(/(PreK|K|\d+)-(\d+)/);
  if (!matches) {
    return false;
  }

  var min = gradeStringToNumber(matches[1]);
  var max = gradeStringToNumber(matches[2]);
  
  var filterpass = (min <= sliderMax && max >= sliderMin);
  console.log(filterpass, "min", min, "max", max, "sliderMin", sliderMin, "sliderMax", sliderMax, aData[0]);
  return filterpass;
}


/********************

 THIRD PARTY PLUGINS

 These useful functions come verbatim from the Datatable forums and docs.

 ********************/

/*
 * This plug-in will provide numeric sorting for numeric columns 
 * which have extra formatting, such as thousands seperators, 
 * currency symobols or any other non-numeric data.
 *
 * Copied from http://datatables.net/plug-ins/sorting
 * Author: Allan Jardine
 */
jQuery.fn.dataTableExt.oSort['formatted-num-asc'] = function(a,b) {
  /* Remove any formatting */
  var x = a.match(/\d/) ? a.replace( /[^\d\-\.]/g, "" ) : 0;
  var y = b.match(/\d/) ? b.replace( /[^\d\-\.]/g, "" ) : 0;
      
  /* Parse and return */
  return parseFloat(x) - parseFloat(y);
};
jQuery.fn.dataTableExt.oSort['formatted-num-desc'] = function(a,b) {
  var x = a.match(/\d/) ? a.replace( /[^\d\-\.]/g, "" ) : 0;
  var y = b.match(/\d/) ? b.replace( /[^\d\-\.]/g, "" ) : 0;
      
  return parseFloat(y) - parseFloat(x);
};

/*
 * Retrieves the full set of data with current filters applied (not
 * just the current page). This is needed for the map view.
 * 
 * Source: http://datatables.net/forums/discussion/1029/fngetfiltereddata/p1
 * Author: mikej
 */
$.fn.dataTableExt.oApi.fnGetFilteredData = function ( oSettings ) {
  var a = [];
  for ( var i=0, iLen=oSettings.aiDisplay.length ; i<iLen ; i++ ) {
    a.push(oSettings.aoData[ oSettings.aiDisplay[i] ]._aData);
  }
  return a;
}

/*
 * Ensure that String.trim is available.
 */
if(typeof(String.prototype.trim) === "undefined")
{
   String.prototype.trim = function() 
   {
     return String(this).replace(/^\s+|\s+$/g, '');
   };
}
