<template>
  <validation-observer tag="form" ref="observerAbout" v-slot="{ errors }">
    <div class="create-deal content-block pb-5">
      <div class="content-block__body pb-0">
        <div class="container-fluid">
          <div class="create-deal__body pb-5 mb-5 mb-lg-0">
            <header-stage />
            <h1 class="create-deal__title">О сделке</h1>
            <section class="create-deal__section mb-5 pb-3">
              <h4 class="create-deal__subtitle">Комментарий</h4>
              <div class="create-deal__alert">
                <svg class="icon icon-comment">
                  <use xlink:href="#icon-comment"></use>
                </svg>
                <div>Опишите все нюансы сделки и товаров - только так мы сможем вас защитить в конфликтной ситуации.</div>
              </div>
              <validation-provider
                  name="Заполните описание сделки"
                  rules="required"
                  v-slot="{ errors }"
                  tag="div"
              >
                <div class="input" :class="errors.length ? 'input_error' : ''">
                  <label class="input__label">Подробно опишите товар, его характеристики и условия сделки</label>
                  <div v-if="errors.length" class="input__error input__error__textarea">
                    {{ errors[0] }}
                  </div>
                  <textarea
                      placeholder="Опишите товар, его характеристики и условия сделки"
                      class="input__field"
                      v-model="descriptionText"
                      name="description"
                      data-test="description"
                  ></textarea>
                  <a href="javascript:void(0);" class="small" @click="showModal('dealDescriptionImportant')">
                    <strong>Почему важно описание?</strong>
                  </a>
                </div>
              </validation-provider>
            </section>
            <section class="create-deal__section mb-5 pb-3">
              <h4 class="mb-4">Фотографии</h4>
              <div class="row mt-2" v-if="attachmentsListImg.length > 0">
                <div
                    class="col-lg-3 col-md-6 col-12"
                    v-for="(metadata, index) in attachments"
                    :key="'attach_' + index"
                    data-test="attachmentFile"
                >
                  <div class="loaded-file">
                    <div class="loaded-file__preview">
                      <div class="loaded-file__img">
                        <img
                            :src="metadata.public_url"
                            alt=""
                            @click.prevent="openSlider(index)"
                        />
                      </div>
                      <p class="loaded-file__name">
                        {{ metadata.id ? metadata.id.split('/')[1] : metadata['~id'].split('/')[1] }}
                      </p>
                      <div class="loaded-file__overlay">
                        <a
                            href="javascript:void(0);"
                            class="d-none d-lg-block"
                            data-test="attachmentOpen"
                            @click.prevent="openSlider(index)"
                        >
                          Открыть
                        </a>
                        <a
                            href="javascript:void(0);"
                            class="delete"
                            data-test="attachmentRemove"
                            @click.prevent="removeAttachment(index)"
                        >
                          Удалить
                        </a>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div v-show="attachmentsListImg.length > 0 && fullscreenSlider">
                <div
                    class="slider-container d-flex align-items-center justify-content-center fullscreen"
                    data-test="attachmentSlider"
                    @click="closeSlider"
                >
                  <div class="container-outer container-outer_width-720">
                    <a href="javascript:void(0);" class="popup__close" data-test="attachmentSliderClose" @click="closeSlider">
                      <svg class="icon icon-close"><use xlink:href="#icon-close"></use></svg>
                    </a>
                    <div class="position-relative">
                      <swiper
                          ref="attachmentsSlider"
                          :options="attachmentsSliderOptions"
                          :auto-update="true"
                      >
                        <template
                            v-for="(attachment, index) in attachmentsListImg"
                        >
                          <swiper-slide
                              :key="'attach_' + index"
                              v-if="isImage(attachment.mime_type)"
                          >
                            <img
                                :src="attachment.public_url"
                                class="loaded-file__img"
                                :alt="attachment.description"
                            />
                          </swiper-slide>
                        </template>
                      </swiper>
                      <div class="swiper-button-prev attachments-prev" slot="button-prev" v-show="showImgNavigation"></div>
                      <div class="swiper-button-next attachments-next" slot="button-next" v-show="showImgNavigation"></div>
                    </div>
                    <div class="swiper-pagination attachments-pagination mt-4" slot="pagination" v-show="showImgNavigation"></div>
                  </div>
                </div>
              </div>
              <div v-if="attachmentsListDocs.length > 0">
                <ul class="loaded-file__list">
                  <li
                      v-for="(attachment, index) in attachmentsListDocs"
                      :key="'attach_' + index"
                      class="loaded-file__document"
                  >
                    <a
                        :href="attachment.public_url"
                        target="_blank"
                    >
                            <span class="loaded-file__document-icon svg">
                                <svg class="icon icon-document">
                                  <use xlink:href="#icon-document"></use>
                                </svg>
                            </span>
                      {{ attachment.id.split('/')[1] }}
                    </a>
                  </li>
                </ul>
              </div>
              <validation-provider
                  name="Выберите файлы jpg, jpeg, png, gif"
                  :rules="{ ext: ['jpg', 'jpeg', 'png', 'gif'], required: attachments.length === 0 }"
                  v-slot="{ errors, validate }"
                  tag="div"
                  ref="fileinput"
                  class="position-relative mt-3"
              >
                <div class="file" :class="{ 'file__error input_error': errors.length, 'file__loading': loadingAttachment }">
                  <div v-if="errors.length" class="input__error">{{ errors[0] }}</div>
                  <file-upload
                      id="fileinput"
                      :validate="validate"
                      :errors="errors"
                      data-test="inputFile"
                      @temporaryTokenCreatingError="onTemporaryTokenCreatingError"
                      @fileUploadingStarted="loadingAttachment = true"
                      @fileUploadingEnded="loadingAttachment = false"
                      @fileUploadingError="onFileUploadingError"
                      @fileUploaded="onFileUploaded"
                  />
                  <span>Перетащите файлы сюда или</span>
                  <label
                      for="fileinput"
                      class="button button_size-40 file__button"
                      :class="{ 'button_disabled': loadingAttachment }"
                  >
                    Выберите файл
                  </label>
                </div>
                <div class="file__loader position-absolute d-flex justify-content-center align-items-center" v-if="loadingAttachment">
                  <loader />
                </div>
              </validation-provider>
            </section>
            <section v-if="typeFillup === 'public_create' || typeFillup === 'public_edit'" class="create-deal__section">
              <h4 class="mb-2">Количество использований</h4>
              <validation-provider
                  name="Количество использований"
                  rules="required|decimal|min_value:1|max_value:1000"
                  v-slot="{ errors }"
                  tag="div"
              >
                <div class="input input_visible_label" :class="errors.length ? 'input_error' : ''">
                  <label class="input__label">Укажите сколько покупателей смогут присоединиться к сделке</label>
                  <div v-if="errors.length" class="text-danger small mb-1">
                    Поле обязательно и должно быть от 1 до 1000
                  </div>
                  <div class="row">
                    <div class="col-lg-3 col-6">
                      <input
                          placeholder="0"
                          class="input__field"
                          v-decimal
                          inputmode="decimal"
                          :value="localDealsLimit|onlyInt"
                          @input="localDealsLimit = integerValue($event)"
                          type="text"
                      />
                    </div>
                  </div>
                </div>
              </validation-provider>
            </section>
            <div class="gray-offer mt-5 pt-5">
              Создавая сделку, вы соглашаетесь с <a href="#" target="_blank">офертой сервиса</a>.
            </div>
          </div>
        </div>
      </div>
    </div>
    <next-stage-menu
        :next-stage-force-text="nextStageForceText"
        :disable-next="!!errors.length"
        @nextStageClicked="nextStageClicked"
    ></next-stage-menu>
    <default-popup
        id="dealDescriptionImportant"
        :data="dealDescriptionImportant"
        success-button-text="Понятно"
    />
  </validation-observer>
</template>

<script>
import HeaderStage from '@/components/deal_fillup/HeaderStage';
import FileUpload from '@/components/deal_fillup/about_stage_components/FileUpload';
import NextStageMenu from '@/components/deal_fillup/NextStageMenu';
import Loader from '@/components/common/Loader';
const DefaultPopup = () => import('@/components/modals/DefaultPopup');
import dealDescriptionImportant from '@/assets/data/deal_description_important';
import { Swiper as SwiperClass, Pagination, Navigation } from 'swiper/js/swiper.esm';
import getAwesomeSwiper from 'vue-awesome-swiper/dist/exporter';
SwiperClass.use([Pagination, Navigation]);
const { Swiper, SwiperSlide } = getAwesomeSwiper(SwiperClass);
import 'swiper/css/swiper.css';

import {mapActions, mapState} from 'vuex';

export default {
  name: 'AboutStage',
  components: {
    HeaderStage,
    NextStageMenu,
    FileUpload,
    Loader,
    Swiper,
    SwiperSlide,
    DefaultPopup
  },
  data() {
    return {
      loadingAttachment: false,
      attachmentsSliderOptions: {
        observer: true,
        autoHeight: true,
        slidesPerView: 1,
        spaceBetween: 20,
        pagination: {
          el: '.attachments-pagination',
          clickable: true
        },
        navigation: {
          nextEl: '.attachments-next',
          prevEl: '.attachments-prev'
        }
      },
      fullscreenSlider: false,
      dealDescriptionImportant
    }
  },
  computed: {
    ...mapState([
      'isAuthorized'
    ]),
    ...mapState('dealFillup', [
      'attachments',
      'description',
      'typeFillup',
      'dealsLimit'
    ]),
    descriptionText: {
      get() {
        return this.description
      },
      set(value) {
        return this.setDescription(value)
      }
    },
    localDealsLimit: {
      get() {
        return this.dealsLimit
      },
      set(value) {
        return this.setDealsLimit(value)
      }
    },
    swiper() {
      return this.$refs.attachmentsSlider.$swiper
    },
    attachmentsListImg() {
      return this.attachments.filter(item => this.isImage(item.mime_type));
    },
    attachmentsListDocs() {
      return this.attachments.filter(item => !this.isImage(item.mime_type));
    },
    showImgNavigation() {
      return this.attachmentsListImg.length > 1;
    },
    nextStageForceText() {
      switch (this.typeFillup) {
        case 'create':
        case 'public_create':
          return 'Создать сделку';
        case 'confirm':
          return 'Подтвердить сделку';
        case 'edit':
        case 'public_edit':
          return 'Данные';
        case 'cod_create':
        case 'cod_edit':
          return 'Данные отправителя';
        default:
          return null;
      }
    }
  },
  mounted() {
    if (this.typeFillup !== 'edit') {
      this.$root.$on('authorizationSuccessAction', (data) => {
        if (data.action === 'create_deal' || data.action === 'confirm_deal') {
          this.$emit('dealFillupSubmit');
        }
      });
    }
  },
  methods: {
    ...mapActions('dealFillup', [
      'setDescription',
      'setStage',
      'addAttachments',
      'removeAttachments',
      'setDealsLimit'
    ]),
    onTemporaryTokenCreatingError(response) {
      alert("Ошибка получения временного токена для загрузки файла.");
      console.log(response);
    },
    onFileUploadingError(response) {
      alert("Ошибка загрузки файла.");
      console.log(response);
    },
    onFileUploaded(metadataCollection) {
      metadataCollection.forEach((element) => {
        this.addAttachments(element);
      });
    },
    removeAttachment(index) {
      this.removeAttachments(index);
    },
    async nextStageClicked() {
      const isValid = await this.$refs.observerAbout.validate();
      if (isValid && this.attachments.length > 0) {
        if (this.typeFillup === 'create') {
          this.sendMetricEvent('deals_btm_end_step_3');
        } else if (this.typeFillup === 'public_create') {
          this.sendMetricEvent('public-deals_btm_end_step_3');
        } else if (this.typeFillup === 'cod_create') {
          this.sendMetricEvent('cod-deals_btm_end_step_3');
        }
        if (this.typeFillup === 'edit' || this.typeFillup === 'public_edit') {
          this.setStage('contacts');
        } else if (this.typeFillup === 'cod_create' || this.typeFillup === 'cod_edit') {
          this.setStage('senderContacts');
        } else {
          if (!this.isAuthorized) {
            const actionEvent = this.typeFillup === 'create' ? 'create_deal' : (this.typeFillup === 'confirm' ? 'confirm_deal' : '');
            this.showModal('loginFrame', {action: actionEvent});
          } else {
            this.$emit('dealFillupSubmit');
          }
        }
      } else {
        await this.scrollToElement('.input_error');
      }
    },
    isImage(mimeType) {
      return mimeType.indexOf('image/') === 0
    },
    openSlider(index) {
      if(!this.fullscreenSlider) {
        this.fullscreenSlider = true;
        this.swiper.slideTo(index, 0);
        this.swiper.update();
        document.querySelector('body').style.overflow = 'hidden';
      }
    },
    closeSlider(event) {
      event.preventDefault();
      if((event.target.classList.contains('fullscreen') || event.target.classList.contains('popup__close')) && this.fullscreenSlider) {
        this.fullscreenSlider = false;
        document.querySelector('body').style.overflow = '';
      }
    },
    integerValue(event) {
      const value = event.target.value,
        cutValue = value ? value.toString().replace(/[^\d]+/g, '') : value;
      return cutValue ? Number(cutValue) : cutValue;
    }
  },
  filters: {
    onlyInt: (value) => value ? value.toString().replace(/[^\d]+/g, '') : value
  }
}
</script>

