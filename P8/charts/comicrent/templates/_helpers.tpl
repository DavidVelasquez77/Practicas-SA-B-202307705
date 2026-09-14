{{/*
Labels adicionales del chart principal.
Demuestra el uso de named templates y range.
*/}}
{{- define "comicrent.extraLabels" -}}
{{- range $key, $value := .Values.extraLabels }}
{{ $key }}: {{ $value | quote }}
{{- end }}
{{- end }}