<?php
$instance['DestinEvent'] = array_merge($instance['destinevent'], array(
    "loader" => array(
        "minecraft_version" => "1.21.1",
        "loader_type" => "neoforge",
        "loader_version" => "latest"
    ),
    "verify" => true,
    "ignored" => array(
        'config',
        'essential',
        'logs',
        'resourcepacks',
        'saves',
        'screenshots',
        'shaderpacks',
        'W-OVERFLOW',
        'options.txt',
        'optionsof.txt'
    ),
    "whitelist" => array(),
    "whitelistActive" => false,
    "status" => array(
        "nameServer" => "Destin Event",
        "ip" => "91.197.6.19",
        "port" => 21495
    )
));

?>
