#!/usr/bin/env godot --script
# Variant encoding/decoding helper for remote debugger protocol
# Usage: godot --script variant_codec.gd -- --action encode --data '["evaluate", 0, ["print(123)", 0]]'

extends SceneTree

func _init():
	var args = OS.get_cmdline_args()
	var action = ""
	var data = ""

	for i in range(args.size()):
		match args[i]:
			"--action":
				if i + 1 < args.size():
					action = args[i + 1]
			"--data":
				if i + 1 < args.size():
					data = args[i + 1]

	if action.is_empty() or data.is_empty():
		printerr("Usage: --action [encode|decode] --data 'json_string_or_hex_data'")
		quit(1)
		return

	match action:
		"encode":
			encode_message(data)
		"decode":
			decode_message(data)
		_:
			printerr("Unknown action: " + action)
			quit(1)

func encode_message(json_data: String):
	# Parse JSON input
	var json = JSON.new()
	var parse_result = json.parse(json_data)
	if parse_result != OK:
		printerr("Invalid JSON: " + json_data)
		quit(1)
		return

	var message_array = json.data
	if typeof(message_array) != TYPE_ARRAY:
		printerr("Expected array in JSON")
		quit(1)
		return

	# Convert to Variant and encode
	var variant_data = var_to_bytes(message_array)

	# Create the full message: [4 bytes size] + [variant data]
	var size_bytes = PackedByteArray()
	size_bytes.resize(4)
	size_bytes.encode_u32(0, variant_data.size())

	var full_message = size_bytes + variant_data

	# Output as hex string
	print("HEX:" + full_message.hex_encode())
	quit(0)

func decode_message(hex_data: String):
	# Remove HEX: prefix if present
	if hex_data.begins_with("HEX:"):
		hex_data = hex_data.substr(4)

	# Convert hex to bytes
	var message_bytes = hex_data.hex_decode()

	if message_bytes.size() < 4:
		printerr("Message too short")
		quit(1)
		return

	# Read size (first 4 bytes)
	var size = message_bytes.decode_u32(0)

	if message_bytes.size() < 4 + size:
		printerr("Incomplete message")
		quit(1)
		return

	# Extract variant data
	var variant_data = message_bytes.slice(4, 4 + size)

	# Decode variant
	var decoded = bytes_to_var(variant_data)

	# Output as JSON
	print("JSON:" + JSON.stringify(decoded))
	quit(0)