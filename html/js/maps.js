var map;
var infoWindow;
var markers = [];
 
function init_map() {
  var myOptions = {
    center: new google.maps.LatLng(38, -97.7372),
    zoom: 4,
    mapTypeId: google.maps.MapTypeId.ROADMAP
  };
  map = new google.maps.Map(document.getElementById("map_canvas"),
                                myOptions);

  infoWindow = new google.maps.InfoWindow();
}

// go through the db, geocode and plot them on a map
function plot_points(models) {
  clear_markers();
  
  // start with just the whole data set. we'll go to the currently visible in a bit.
  var group_by_location = {};

  for (var i = 0; i < models.length; ++i) {
    var model = models[i];
    if (!group_by_location[model.location]) {
      group_by_location[model.location] = [];
    }
    group_by_location[model.location].push(model);
  }

  for (var location_name in group_by_location) {
    var location = locations[location_name];
    if (!location) {
      console.error("Missing geocode info for" , model);
      continue;
    }

    var content = "<h3>" + location_name + "</h3>";
    var models = group_by_location[location_name];
    for (var i = 0; i < models.length; ++i) {
      var model = models[i];
      content = content + "<p>" + model['title'] + "</p>";
    }

    var latLng = new google.maps.LatLng(location.lat,
                                        location.lng);

    make_marker(latLng, content);
  }

  fit_bounds();
}

function fit_bounds() {
  if (markers.length > 0) {

    var bounds = new google.maps.LatLngBounds();

    for (var i = 0; i < markers.length; ++i) {
      var latLng = markers[i].position;
      bounds.extend(latLng);
    }

    map.fitBounds(bounds);

    // we only have city-level accuracy, so don't zoom too close
    if (map.getZoom() > 6) {
      map.setZoom(6);
    }
  }
}

function clear_markers() {
  for (i in markers) {
    markers[i].setMap(null);
    markers[i] = null;
  }
  markers = [];
}

function make_marker(latLng, content) {
  var marker = new google.maps.Marker({position: latLng,
                                       map:map});
  
  google.maps.event.addDomListener(marker, "click", function() {
      infoWindow.setContent(content);
      infoWindow.open(map, marker);
    });

  markers.push(marker);

  return marker;
}

function resize_map() {
  google.maps.event.trigger(map, "resize");
  fit_bounds();
}