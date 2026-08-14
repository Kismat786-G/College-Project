<?php
/**
 * Same-origin proxy for public OpenStreetMap search and routing services.
 * Keeping these requests on the server avoids browser CORS issues and lets us
 * identify this local project to the geocoding provider.
 */
header('Content-Type: application/json; charset=utf-8');

function map_response($data, $status = 200) {
    http_response_code($status);
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

function map_fetch($url) {
    $curl = curl_init($url);
    curl_setopt_array($curl, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CONNECTTIMEOUT => 5,
        CURLOPT_TIMEOUT => 12,
        CURLOPT_HTTPHEADER => [
            'Accept: application/json',
            'User-Agent: NepalTravelCollegeProject/1.0 (local development)'
        ]
    ]);
    $body = curl_exec($curl);
    $status = (int) curl_getinfo($curl, CURLINFO_RESPONSE_CODE);
    curl_close($curl);
    return $status >= 200 && $status < 300 ? $body : false;
}

function map_coordinate($value, $minimum, $maximum) {
    if (!is_numeric($value)) return null;
    $coordinate = (float) $value;
    return $coordinate >= $minimum && $coordinate <= $maximum ? $coordinate : null;
}

$action = $_GET['action'] ?? '';

if ($action === 'search') {
    $query = trim((string) ($_GET['q'] ?? ''));
    if (mb_strlen($query) < 2 || mb_strlen($query) > 120) {
        map_response(['success' => false, 'message' => 'Enter a location name with at least two characters.'], 400);
    }

    $params = http_build_query([
        'format' => 'jsonv2',
        'addressdetails' => 1,
        'limit' => 6,
        'countrycodes' => 'np',
        'accept-language' => 'en',
        'q' => $query
    ]);
    $body = map_fetch('https://nominatim.openstreetmap.org/search?' . $params);
    if ($body === false) map_response(['success' => false, 'message' => 'Location search is temporarily unavailable.'], 503);

    $rawResults = json_decode($body, true);
    $results = [];
    foreach (is_array($rawResults) ? $rawResults : [] as $item) {
        $lat = map_coordinate($item['lat'] ?? null, -90, 90);
        $lng = map_coordinate($item['lon'] ?? null, -180, 180);
        if ($lat === null || $lng === null) continue;
        $results[] = [
            'label' => (string) ($item['display_name'] ?? 'Unnamed location'),
            'lat' => $lat,
            'lng' => $lng,
            'type' => (string) ($item['type'] ?? 'place')
        ];
    }
    map_response(['success' => true, 'results' => $results]);
}

if ($action === 'route') {
    $originLat = map_coordinate($_GET['origin_lat'] ?? null, -90, 90);
    $originLng = map_coordinate($_GET['origin_lng'] ?? null, -180, 180);
    $destinationLat = map_coordinate($_GET['destination_lat'] ?? null, -90, 90);
    $destinationLng = map_coordinate($_GET['destination_lng'] ?? null, -180, 180);
    if ($originLat === null || $originLng === null || $destinationLat === null || $destinationLng === null) {
        map_response(['success' => false, 'message' => 'Valid start and destination coordinates are required.'], 400);
    }

    $coordinates = rawurlencode($originLng . ',' . $originLat . ';' . $destinationLng . ',' . $destinationLat);
    $body = map_fetch('https://router.project-osrm.org/route/v1/driving/' . $coordinates . '?overview=full&geometries=geojson');
    if ($body === false) map_response(['success' => false, 'message' => 'Driving route is temporarily unavailable.'], 503);

    $routeData = json_decode($body, true);
    $route = $routeData['routes'][0] ?? null;
    if (($routeData['code'] ?? '') !== 'Ok' || !is_array($route)) {
        map_response(['success' => false, 'message' => 'No driving route was found for these locations.'], 404);
    }

    map_response([
        'success' => true,
        'distance_meters' => (float) ($route['distance'] ?? 0),
        'duration_seconds' => (float) ($route['duration'] ?? 0),
        'geometry' => $route['geometry'] ?? null
    ]);
}

map_response(['success' => false, 'message' => 'Invalid map action.'], 400);
