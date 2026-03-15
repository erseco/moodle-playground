PORT ?= 8080
LOCAL_PORT ?= 8081
LOCAL_PHP ?= php84
CHANNEL ?= stable500

.PHONY: deps build-worker bundle prepare serve up up-local clean reset

deps:
	npm install

build-worker:
	npm run build:worker

bundle:
	CHANNEL=$(CHANNEL) npm run bundle

prepare: deps build-worker bundle

serve:
	python3 -m http.server $(PORT)

up: prepare serve

up-local: bundle
	./scripts/setup-local.sh $(LOCAL_PORT) $(LOCAL_PHP)

clean:
	rm -rf .cache
	rm -rf assets/moodle
	rm -f assets/manifests/latest.json
	touch assets/manifests/.gitkeep

reset: clean
	rm -rf dist
