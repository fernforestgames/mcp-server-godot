class_name MCPProtocol
extends RefCounted
## Protocol encoding/decoding for MCP bridge messages

const PREFIX := "[MCP_BRIDGE:"
const SUFFIX := "]"


## Encode a message dictionary to the bridge format
static func encode(msg: Dictionary) -> String:
	var json := JSON.stringify(msg)
	var b64 := Marshalls.utf8_to_base64(json)
	return PREFIX + b64 + SUFFIX


## Decode a bridge message from a line of text
## Returns null if the line is not a valid bridge message
static func decode(line: String) -> Variant:
	if not line.begins_with(PREFIX) or not line.ends_with(SUFFIX):
		return null

	var b64 := line.substr(PREFIX.length(), line.length() - PREFIX.length() - SUFFIX.length())

	var json := Marshalls.base64_to_utf8(b64)
	if json.is_empty():
		return null

	var parsed = JSON.parse_string(json)
	if parsed == null or not parsed is Dictionary:
		return null

	# Basic validation
	var dict := parsed as Dictionary
	if not dict.has("id") or not dict.has("type") or not dict.has("command"):
		return null

	return dict


## Create a response message
static func create_response(request_id: String, command: String, payload: Variant) -> Dictionary:
	return {
		"id": request_id,
		"type": "response",
		"command": command,
		"payload": payload
	}


## Create an error response message
static func create_error_response(request_id: String, command: String, code: String, message: String) -> Dictionary:
	return {
		"id": request_id,
		"type": "response",
		"command": command,
		"payload": null,
		"error": {
			"code": code,
			"message": message
		}
	}


## Create an event message (unsolicited notification to the server)
static func create_event(command: String, payload: Variant) -> Dictionary:
	return {
		"id": _generate_uuid(),
		"type": "event",
		"command": command,
		"payload": payload
	}


static func _generate_uuid() -> String:
	# Simple UUID v4 generation
	var chars := "0123456789abcdef"
	var uuid := ""
	for i in range(32):
		if i == 8 or i == 12 or i == 16 or i == 20:
			uuid += "-"
		if i == 12:
			uuid += "4"  # Version 4
		elif i == 16:
			uuid += chars[8 + (randi() % 4)]  # Variant
		else:
			uuid += chars[randi() % 16]
	return uuid
