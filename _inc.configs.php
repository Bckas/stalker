<?php

error_reporting(0);
date_default_timezone_set("Asia/Kolkata");

$APP_CONFIG['APP_NAME'] = "Stalker Portal";
$APP_CONFIG['DEFAULT_STREAM_PROXY_STATUS'] = "OFF";
$APP_CONFIG['DEFAULT_ADMIN_PIN'] = "1234";
$data_folder = __DIR__ . "/__AppData__";
if (!is_dir($data_folder)) {
    if (!@mkdir($data_folder, 0777, true)) {
        $data_folder = sys_get_temp_dir() . "/__AppData__";
        if (!is_dir($data_folder)) {
            @mkdir($data_folder, 0777, true);
        }
    }
} elseif (!is_writable($data_folder)) {
    $data_folder = sys_get_temp_dir() . "/__AppData__";
    if (!is_dir($data_folder)) {
        @mkdir($data_folder, 0777, true);
    }
}
$APP_CONFIG['DATA_FOLDER'] = $data_folder;

function app_get_data_file_path($filename) {
    global $APP_CONFIG;
    $primary = $APP_CONFIG['DATA_FOLDER'] . "/" . $filename;
    if (file_exists($primary)) {
        return $primary;
    }
    $fallback = __DIR__ . "/__AppData__/" . $filename;
    if (file_exists($fallback)) {
        return $fallback;
    }
    return $primary;
}

if(!file_exists($APP_CONFIG['DATA_FOLDER']."/.htaccess")){ @file_put_contents($APP_CONFIG['DATA_FOLDER']."/.htaccess", "deny from all"); }
if(!file_exists($APP_CONFIG['DATA_FOLDER']."/index.php")){ @file_put_contents($APP_CONFIG['DATA_FOLDER']."/index.php", ""); }

// FIXED: Protocol detection
$streamenvproto = "http";
if(isset($_SERVER['HTTPS'])){ if($_SERVER['HTTPS'] == "on"){ $streamenvproto = "https"; } }
if(isset($_SERVER['HTTP_X_FORWARDED_PROTO'])){ if($_SERVER['HTTP_X_FORWARDED_PROTO'] == "https"){ $streamenvproto = "https"; }}

// FIXED: Don't modify HTTP_HOST - keep original with port
$original_host = $_SERVER['HTTP_HOST']; // Keep full host with port

// FIXED: Don't replace localhost with 127.0.0.1
// Just use the host as is
$plhoth = $original_host;
$plhoth = str_replace(" ", "%20", $plhoth);

//===================================================================//

function response($status, $code, $message, $data)
{
    header("Content-Type: application/json");
    header("Access-Control-Allow-Origin: *");
    $response = array("status" => $status, "code" => $code, "message" => $message, "data" => $data);
    print(json_encode($response, JSON_UNESCAPED_SLASHES));
    exit();
}

function generateRandomAlphanumericString($length)
{
    $characters = '0123456789abcdefghijkmnpqrstuvwxyzABCDEFGHIJKLMNPQRSTUVWXYZ';
    $charactersLength = strlen($characters);
    $randomString = '';
    for ($i = 0; $i < $length; $i++) {
        $randomString .= $characters[rand(0, $charactersLength - 1)];
    }
    return $randomString;
}

function hextorgb ($hexstring)
{
    $integar = hexdec($hexstring);
    return array("red" => 0xFF & ($integar >> 0x10), "green" => 0xFF & ($integar >> 0x8), "blue" => 0xFF & $integar);
}

function isValidAdminPIN($pin)
{
    $output = false;
    if(preg_match('/^[0-9]{4}$/', $pin))  {
        $output = true;
    }
    return $output;
}

function cleanString($string)
{
    $string = str_replace(" ", "_", $string);
    return $string;
}

function getRootBase($url)
{
    $output = "";
    $xrl = parse_url($url);
    if(isset($xrl['host']) && !empty($xrl['host'])) {
        $port = isset($xrl['port']) ? ":" . $xrl['port'] : "";
        $output = $xrl['scheme']."://".$xrl['host'].$port;
    }
    return $output;
}

function getRelativeBase($url)
{
    if(stripos($url, "?") !== false) {
        $xrl = explode("?", $url);
        if(isset($xrl[0]) && !empty($xrl[0])) {
            $url = trim($xrl[0]);
        }
    }
    $url_base = str_replace(basename($url), '', $url);
    return $url_base;
}

function extractURIPart($vine)
{
    $output = "";
    $h1 = explode('URI="', $vine);
    if(isset($h1[1]))
    {
        $h2 = explode('"', $h1[1]);
        if(isset($h2[0]) && !empty($h2[0]))
        {
            $output = trim($h2[0]);
        }
    }
    return $output;
}

function ex_encdec($action, $data) {
    $output = '';
    $key = 'tuj2sDq6w0CqGstzTmHEi1a0q40SpMWSyGpP51cdXi5CnLwNJ7tZmSe2zxgYFXjKifJYHuEdwPmUTI0yaH0G8A2bRZpUZYGZ';
    if($action == "decrypt"){ $data = base64_decode(base64_decode($data)); }
    $dataLength = strlen($data);
    $keyLength = strlen($key);
    for ($i = 0; $i < $dataLength; ++$i) { $output .= $data[$i] ^ $key[$i % $keyLength]; }
    if($action == "encrypt"){ $output = str_replace("=", "", base64_encode(base64_encode($output))); }
    return $output;
}

function getRequest($url, $headers)
{
    $process = curl_init($url);
    curl_setopt($process, CURLOPT_HTTPHEADER, $headers);
    curl_setopt($process, CURLOPT_HEADER, 0);
    curl_setopt($process, CURLOPT_TIMEOUT, 10);
    curl_setopt($process, CURLOPT_RETURNTRANSFER, 1);
    curl_setopt($process, CURLOPT_FOLLOWLOCATION, 1);
    $return = curl_exec($process);
    $effURL = curl_getinfo($process, CURLINFO_EFFECTIVE_URL);
    $httpcode = curl_getinfo($process, CURLINFO_HTTP_CODE);
    curl_close($process);
    return array("url" => $effURL, "code" => $httpcode, "data" => $return);
}

function streamRequest($url, $headers)
{
    $process = curl_init($url);
    curl_setopt($process, CURLOPT_HTTPHEADER, $headers);
    curl_setopt($process, CURLOPT_HEADER, 0);
    curl_setopt($process, CURLOPT_TIMEOUT, 0);
    curl_setopt($process, CURLOPT_CONNECTTIMEOUT, 10);
    curl_setopt($process, CURLOPT_FOLLOWLOCATION, 1);
    
    // Disable output buffering to send chunks immediately
    if (ob_get_level()) { ob_end_clean(); }
    
    curl_setopt($process, CURLOPT_WRITEFUNCTION, function($curl, $data) {
        echo $data;
        return strlen($data);
    });
    
    curl_exec($process);
    curl_close($process);
}

function postRequest($url, $headers, $payload)
{
    $process = curl_init($url);
    curl_setopt($process, CURLOPT_POST, 1);
    curl_setopt($process, CURLOPT_POSTFIELDS, $payload);
    curl_setopt($process, CURLOPT_HTTPHEADER, $headers);
    curl_setopt($process, CURLOPT_HEADER, 0);
    curl_setopt($process, CURLOPT_TIMEOUT, 10);
    curl_setopt($process, CURLOPT_RETURNTRANSFER, 1);
    curl_setopt($process, CURLOPT_FOLLOWLOCATION, 1);
    $return = curl_exec($process);
    $effURL = curl_getinfo($process, CURLINFO_EFFECTIVE_URL);
    $httpcode = curl_getinfo($process, CURLINFO_HTTP_CODE);
    curl_close($process);
    return array("url" => $effURL, "code" => $httpcode, "data" => $return);
}

//===================================================================//

function app_recordalogs($status, $message)
{
    if(app_logging("get") == "OFF") { return true; }
    global $APP_CONFIG;
    $path_actionlogs = $APP_CONFIG['DATA_FOLDER']."/axLogs.enc";
    $log_msg = date('F d, Y h:i:s A')." || ".$message." || ".$_SERVER['REMOTE_ADDR']." - ".$_SERVER['HTTP_USER_AGENT']."\n";
    if(@file_put_contents($path_actionlogs, $log_msg, FILE_APPEND)){ return true; }else{ return false; }
}

function app_accesspin($action, $data)
{
    global $APP_CONFIG; $kdata = "";
    $kpath_read = app_get_data_file_path("axPIN.enc");
    $kpath_write = $APP_CONFIG['DATA_FOLDER']."/axPIN.enc";
    if($action == "update")
    {
        $output = false;
        if(isValidAdminPIN($data) && @file_put_contents($kpath_write, $data)) {
            $output = true;
        }
        return $output;
    }
    else
    {
        if(file_exists($kpath_read)){ $kdata = @file_get_contents($kpath_read); }
        if(!empty($kdata)) {
            return $kdata;
        } else {
            if(isset($APP_CONFIG['DEFAULT_ADMIN_PIN']) && isValidAdminPIN($APP_CONFIG['DEFAULT_ADMIN_PIN'])) {
                return $APP_CONFIG['DEFAULT_ADMIN_PIN'];
            } else {
                return "";
            }
        }
    }
}

function app_macportaldetail($action, $url, $mac_id, $serial, $deviceid1, $deviceid2, $signature)
{
    global $APP_CONFIG;
    $mdata = array();
    $mpath_read = app_get_data_file_path("axMAC.enc");
    $mpath_write = $APP_CONFIG['DATA_FOLDER']."/axMAC.enc";
    if(file_exists($mpath_read)) {
        $mget = @file_get_contents($mpath_read);
        if(!empty($mget)) {
            $mjson = @json_decode($mget, true);
            if(isset($mjson['server_url']) && !empty($mjson['server_url'])) { $mdata = $mjson;}
        }
    }
    if($action == "update")
    {
        $save_data = array(
            "server_url" => $url,
            "mac_id" => $mac_id,
            "serial" => $serial,
            "device_id1" => $deviceid1,
            "device_id2" => $deviceid2,
            "signature" => $signature
        );
        $saved = @file_put_contents($mpath_write, json_encode($save_data, JSON_UNESCAPED_SLASHES));
        if($saved !== false) {
            // Auto generate auxiliary config files with default 'OFF' if not present
            $path_pxy = $APP_CONFIG['DATA_FOLDER']."/axSTMPXY.enc";
            $path_log = $APP_CONFIG['DATA_FOLDER']."/axLOGSTS.enc";
            if(!file_exists($path_pxy)){ @file_put_contents($path_pxy, "OFF"); }
            if(!file_exists($path_log)){ @file_put_contents($path_log, "OFF"); }
            if(!file_exists($APP_CONFIG['DATA_FOLDER']."/axPBKCH.enc")){ @file_put_contents($APP_CONFIG['DATA_FOLDER']."/axPBKCH.enc", "OFF"); }
            if(!file_exists($APP_CONFIG['DATA_FOLDER']."/axPBKEXP.enc")){ @file_put_contents($APP_CONFIG['DATA_FOLDER']."/axPBKEXP.enc", "14400"); }
            if(!file_exists($APP_CONFIG['DATA_FOLDER']."/axADMBTN.enc")){ @file_put_contents($APP_CONFIG['DATA_FOLDER']."/axADMBTN.enc", "ON"); }
            return true;
        }
        return false;
    }
    else
    {
        return $mdata;
    }
}

function app_streamproxy($action)
{
    global $APP_CONFIG;
    $path_read = app_get_data_file_path("axSTMPXY.enc");
    $path_write = $APP_CONFIG['DATA_FOLDER']."/axSTMPXY.enc";
    if(isset($APP_CONFIG['DEFAULT_STREAM_PROXY_STATUS']) && $APP_CONFIG['DEFAULT_STREAM_PROXY_STATUS'] == "ON" || $APP_CONFIG['DEFAULT_STREAM_PROXY_STATUS'] == "OFF") { $output = $APP_CONFIG['DEFAULT_STREAM_PROXY_STATUS']; }else{ $output = "OFF"; }
    if(file_exists($path_read)) {
        $data_StmPxy = @file_get_contents($path_read);
        if($data_StmPxy == "ON" || $data_StmPxy == "OFF") {
            $output = $data_StmPxy;
        }
    }
    if($action == "toggle")
    {
        if($output == "ON"){ $new_int = "OFF"; }else{ $new_int = "ON"; }
        if(@file_put_contents($path_write, $new_int)){ return true; }else{ return false; }
    }
    else
    {
        return $output;
    }
}

function app_genre_filter($action, $data = array())
{
    global $APP_CONFIG;
    $fpath_read = app_get_data_file_path("axGenFil.enc");
    $fpath_write = $APP_CONFIG['DATA_FOLDER']."/axGenFil.enc";
    $output = array();
    
    if(file_exists($fpath_read)) {
        $fdata = @file_get_contents($fpath_read);
        if(!empty($fdata)) {
            $output = @json_decode($fdata, true);
        }
    }
    
    if($action == "update")
    {
        if(is_array($data)) {
            if(@file_put_contents($fpath_write, json_encode($data, JSON_UNESCAPED_SLASHES))) {
                return true;
            }
        }
        return false;
    }
    else
    {
        return is_array($output) ? $output : array();
    }
}

function app_admin_button($action)
{
    global $APP_CONFIG;
    $path_read = app_get_data_file_path("axADMBTN.enc");
    $path_write = $APP_CONFIG['DATA_FOLDER']."/axADMBTN.enc";
    $output = "ON"; // Default
    if(file_exists($path_read)) {
        $data_AdminBtn = trim(@file_get_contents($path_read));
        if($data_AdminBtn == "ON" || $data_AdminBtn == "OFF") {
            $output = $data_AdminBtn;
        }
    }
    if($action == "toggle")
    {
        if($output == "ON"){ $new_int = "OFF"; }else{ $new_int = "ON"; }
        if(@file_put_contents($path_write, $new_int)){ return true; }else{ return false; }
    }
    else
    {
        return $output;
    }
}

function app_logging($action)
{
    global $APP_CONFIG;
    $path_read = app_get_data_file_path("axLOGSTS.enc");
    $path_write = $APP_CONFIG['DATA_FOLDER']."/axLOGSTS.enc";
    $output = "OFF"; // Default
    if(file_exists($path_read)) {
        $data_Logging = trim(@file_get_contents($path_read));
        if($data_Logging == "ON" || $data_Logging == "OFF") {
            $output = $data_Logging;
        }
    }
    if($action == "toggle")
    {
        if($output == "ON"){ $new_int = "OFF"; }else{ $new_int = "ON"; }
        if(@file_put_contents($path_write, $new_int)){ return true; }else{ return false; }
    }
    else
    {
        return $output;
    }
}

function getChannels($indexed = false)
{
    static $static_channels = null;
    static $indexed_channels = null;
    
    if($static_channels !== null) { 
        return $indexed ? $indexed_channels : $static_channels; 
    }
    
    // Quick security check - only require portal config, not full channel list load
    $mac_details = app_macportaldetail("get", "", "", "", "", "", "");
    if(empty($mac_details['server_url'])){ http_response_code(403); exit(); }
    
    $output = array();
    $list_tv = mac_getallChannels();
    if(isset($list_tv[0])) {
        $output = $list_tv;
        // Build index once
        $indexed_channels = array();
        foreach($output as $itv) {
            if(isset($itv['id'])) {
                $indexed_channels[(string)$itv['id']] = $itv;
            }
        }
    }
    $static_channels = $output;
    return $indexed ? $indexed_channels : $static_channels;
}

function getChannelDetail($id)
{
    $channels = getChannels(true); // Get indexed version
    if(isset($channels[(string)$id])) {
        return $channels[(string)$id];
    }
    return array();
}

function fixlogoissue($logo)
{
    $mac_details = app_macportaldetail("get", "", "", "", "", "", "");
    $server_url = isset($mac_details['server_url']) ? $mac_details['server_url'] : "";
    
    $host = "";
    if(!empty($server_url)) {
        $parsed = parse_url($server_url);
        if(isset($parsed['host'])) {
            $host = $parsed['host'];
            if(isset($parsed['port'])) {
                $host .= ':' . $parsed['port'];
            }
        }
    }

    $imageExtensions = [".png", ".jpg"];
    $emptyReplacements = ['', ""];
    
    $clean_logo = str_replace($imageExtensions, $emptyReplacements, $logo);
    if (is_numeric($clean_logo)) {
        return 'http://' . $host . '/stalker_portal/misc/logos/320/' . $logo;
    } else {        
        return "https://i.ibb.co/VYjhYyK5/stalker-portal.png";
    }
}

function app_playback_cache($action, $val = "")
{
    global $APP_CONFIG;
    $path_CH_read = app_get_data_file_path("axPBKCH.enc");
    $path_CH_write = $APP_CONFIG['DATA_FOLDER']."/axPBKCH.enc";
    $path_EXP_read = app_get_data_file_path("axPBKEXP.enc");
    $path_EXP_write = $APP_CONFIG['DATA_FOLDER']."/axPBKEXP.enc";
    
    $status = "OFF";
    if(file_exists($path_CH_read)) {
        $status = trim(@file_get_contents($path_CH_read));
        if($status !== "ON" && $status !== "OFF") { $status = "OFF"; }
    }
    
    $expiry = 14400; // 4 hours in seconds
    if(file_exists($path_EXP_read)) {
        $expiry = (int)trim(@file_get_contents($path_EXP_read));
        if($expiry <= 0) { $expiry = 14400; }
    }
    
    if($action == "toggle") {
        $new_status = ($status == "ON") ? "OFF" : "ON";
        return @file_put_contents($path_CH_write, $new_status) !== false;
    } elseif($action == "update_expiry") {
        return @file_put_contents($path_EXP_write, (int)$val) !== false;
    } else {
        return array("status" => $status, "expiry" => $expiry);
    }
}

include("_inc.upstrm.php");

?>