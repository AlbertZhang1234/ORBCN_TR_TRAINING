from __future__ import annotations


def validate_options(raw: dict, schema: dict) -> dict:
    if not isinstance(raw, dict) or set(raw) - set(schema):
        raise ValueError('Invalid recognition options')
    values = {}
    for key, field in schema.items():
        value = raw.get(key, field['default'])
        if isinstance(field['default'], bool):
            valid = isinstance(value, bool)
        else:
            valid = type(value) is int and field['min'] <= value <= field['max']
        if not valid:
            raise ValueError(f'Invalid recognition option: {key}')
        values[key] = value
    if values['model_timeout_seconds'] > values['total_timeout_seconds']:
        raise ValueError('Model timeout exceeds the processing budget')
    return values
