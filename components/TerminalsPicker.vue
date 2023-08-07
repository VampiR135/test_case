<template>
  <div>
    <loading-block v-if="loadingMaps" />

    <div class="alert" v-if="isErrorMaps">
      <svg class="icon icon-warning">
        <use xlink:href="#icon-warning"></use>
      </svg>
      <div class="alert__text">
        <h2 class="alert__title">{{ errorMaps.title }}</h2>
        <p>{{ errorMaps.text }}</p>
      </div>
    </div>

    <div class="map" v-if="!loadingMaps && !isErrorMaps">
      <div class="map__search">
        <div class="map__search-header">
          <p class="map__search-label">
            Поиск
            <input
                v-model="searchString"
                data-test="terminalsSearch"
                type="text"
                class="map__search-input"
                placeholder="Введите адрес"
            >
          </p>
          <p class="map__search-message error_message" v-if="!!invalidMarker">{{ invalidMarker }}</p>
        </div>
        <div class="map__search-body" v-bar>
          <ul class="map__search-list" data-test="terminalsList">
            <li
                v-for="(marker, index) in filtredMarkers"
                :key="'marker_' + index"
                class="map__search-item">
              <a
                  href="javascript:void(0);"
                  class="map__search-link"
                  :class="{
                    'map__search-link--active': isObject(activeMarker) && marker.id === activeMarker.id,
                    'map__search-link--disabled': marker.restricted
                    }"
                  @click="selectMarker(marker)"
              >
                <span class="map__search-item-title">
                  {{ marker.name }}
                </span>
                <span class="map__search-item-info mt-1" v-if="!!getMarkerAddress(marker)">
                  {{ getMarkerAddress(marker) }}
                </span>
                <span class="map__search-item-noty mt-1" v-if="marker.restricted">
                  Не принимает посылки указанных размеров
                </span>
              </a>
            </li>
          </ul>
        </div>
      </div>
      <yandex-map
          class="map__map"
          :settings="settingsMap"
          :coords="defaultCity.coords"
          :controls="controlsMap"
          :cluster-options="clusterOptions"
          :zoom="defaultZoom"
          @map-was-initialized="setMapObject"
      >
        <ymap-marker
            v-for="(marker, index) in markers"
            :key="'marker_' + index"
            :marker-id="marker.id"
            :ref="marker.id"
            :coords="[marker.lat, marker.lng]"
            :icon="markerIcon(marker)"
            cluster-name="defaultCluster"
            @click.prevent="selectMarker(marker)"
        />
      </yandex-map>
    </div>
  </div>
</template>

<script>
import { yandexMap, ymapMarker } from 'vue-yandex-maps';
import LoadingBlock from '@/components/common/LoadingBlock';
import { isObject, isObjectEmpty } from '@/assets/helpers/object_helpers';

export default {
  name: 'TerminalsPicker',
  components: {
    yandexMap,
    ymapMarker,
    LoadingBlock
  },
  props: {
    loadingMaps: {
      type: Boolean,
      default: false
    },
    errorMaps: {
      type: Object,
      default: () => {
        return {
          title: null,
          text: null
        }
      },
    },
    defaultCity: {
      type: Object,
      default: () => {
        return {
          name: null,
          coords: []
        }
      }
    },
    markers: {
      type: Array,
      default: () => {
        return []
      }
    },
    invalidMarker: {
      type: String,
      default: null
    },
    activeMarker: {
      type: Object,
      default: () => {
        return null
      }
    }
  },
  data() {
    return {
      settingsMap: {
        apiKey: '1234567890',
        lang: 'ru_RU',
        coordorder: 'latlong',
        version: '2.1'
      },
      controlsMap: ['fullscreenControl', 'geolocationControl', 'rulerControl', 'zoomControl'],
      mapObject: {},
      clusterOptions: {
        defaultCluster: {
          preset: 'islands#yellowClusterIcons'
        },
      },
      defaultZoom: 13,
      searchString: null
    }
  },
  computed: {
    isErrorMaps() {
      return this.errorMaps.title && this.errorMaps.text;
    },
    isMarkerActiveEmpty() {
      return !isObject(this.activeMarker) || isObject(this.activeMarker) && isObjectEmpty(this.activeMarker);
    },
    filtredMarkers() {
      if(this.searchString) {
        return this.markers.filter((item) => {
          if (this.getMarkerAddress(item).toLowerCase().indexOf(this.searchString.toLowerCase()) !== -1) {
            return true;
          }
        });
      } else {
        return this.markers;
      }
    }
  },
  methods: {
    isObject(object) {
      return isObject(object);
    },
    markerIcon(marker) {
      return {
        layout: 'default#image',
        imageHref: marker.restricted
          ? window.envVariables.CDN_URL.replace(/\/$/, '') + '/img/map/maps_marker_disabled.svg'
          : isObject(this.activeMarker) && !isObjectEmpty(this.activeMarker) && this.activeMarker.id === marker.id
            ? window.envVariables.CDN_URL.replace(/\/$/, '') + '/img/map/maps_marker_active.svg'
            : window.envVariables.CDN_URL.replace(/\/$/, '') + '/img/map/maps_marker.svg',
        imageSize: [20, 28],
        imageOffset: [-10, -1]
      };
    },
    selectMarker(marker) {
      this.$emit('selectMarker', marker);
      this.balloonOpen(marker);
      this.$nextTick(() => {
        this.scrollContainerToElement('map__search-link--active', 'map__search-list');
      });
    },
    markerBalloon(marker) {
      let text = '';
      marker.info.forEach(item => {
        if(item.text) {
          text += `<p>${ item.title }: ${ item.text }</p>`
        }
      });
      return text;
    },
    balloonOpen(marker) {
      // центруем карту по выбранному маркеру с сохранением масштаба
      if(isObjectEmpty(this.mapObject)) {
        return 0;
      }
      const mapZoom = this.mapObject.getZoom() || this.defaultZoom
      this.mapObject.setCenter([marker.lat, marker.lng], mapZoom, {duration: 300});
      this.mapObject.balloon.open(
        // открываем баллун по координатам маркера
        [marker.lat, marker.lng],
        { content: this.markerBalloon(marker) },
        { closeButton: true }
      );
    },
    setMapObject(payload) {
      this.mapObject = payload;
    },
    getMarkerAddress(marker) {
      return marker.info.filter(item => item.code === 'address')[0].text || null;
    },
    scrollContainerToElement(elementClass, containerClass) {
      const element = document.querySelector(`.${elementClass}`).parentElement,
            elementOffset = element ? element.offsetTop : null,
            containerBlock = document.querySelector(`.${containerClass}`);
      if(elementOffset) {
        containerBlock.scrollTo({
          top: elementOffset,
          behavior: 'smooth'
        });
      }
    },
  }
}
</script>

<style lang="scss">
  .vb-dragger {
    z-index: 5;
    width: 6px;
    right: 0;

    .vb-dragger-styler {
      cursor: pointer;
      transition: background-color 300ms;
      background-color: #e2e5e9;
      height: 100%;
    }
    &:hover .vb-dragger-styler {
      background-color: #c5cbd3;
    }
  }
  [class*='balloon__content'] p {
    margin-bottom: 5px;

    &:last-child {
      margin-bottom: 0!important;
    }
  }
  .error_message {
    color: #ff313f!important;
  }
</style>
