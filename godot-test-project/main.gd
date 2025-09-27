extends Node2D

const NOTIFICATION_INTERVAL_MSEC := 1000

var _last_notification_msec := 0

func _ready() -> void:
    print("Game started")
    _last_notification_msec = Time.get_ticks_msec()

func _process(_delta: float) -> void:
    if Time.get_ticks_msec() - _last_notification_msec > NOTIFICATION_INTERVAL_MSEC:
        print("Game running for %.2f seconds" % (Time.get_ticks_msec() / 1000.0))
        _last_notification_msec = Time.get_ticks_msec()
