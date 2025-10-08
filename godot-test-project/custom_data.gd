extends Resource
class_name CustomData

@export var player_name: String = ""
@export var score: int = 0
@export var level: int = 1
@export var inventory: Array[String] = []
@export var stats: Dictionary = {}

func _init(p_name: String = "", p_score: int = 0, p_level: int = 1):
	player_name = p_name
	score = p_score
	level = p_level
