<template>
  <div v-if="deal.invited_phone">
    <div class="share-link__label">Приглашение отправлено на телефон</div>
    <div class="share-link__container">
      <span>+{{ deal.invited_phone }}</span>
      <a
          href="javascript:void(0)"
          class="share-link__button-cancel"
          @click="cancelPhoneInvite"
      >
        Отменить приглашение
      </a>
    </div>
  </div>

  <validation-observer
      v-else
      tag="form"
      ref="observerPhoneInvite"
      class="row align-items-end"
      @submit.prevent="sendPhoneInvite"
  >
    <p class="col-12 mb-4">
      Контрагенту необходимо самостоятельно зарегистрироваться в&#160;личном кабинете с&#160;указанным номером
      телефона. Сделка появится в&#160;разделе приглашений, где он сможет к&#160;ней присоединится.
    </p>
    <validation-provider
        :rules="{ required: true, length: maskLength }"
        name="Заполните телефон"
        v-slot="{ errors }"
        tag="div"
        class="col-lg-8 col-12"
    >
      <div class="input input_mb-0 input_big input_visible_label"
           :class="errors.length ? 'input_error' : ''">
        <label class="input__label input__label_big">{{inputLabelText}}</label>
        <div v-if="errors.length" class="input__error">
          {{ errors[0] }}
        </div>
        <phone-field
            input-name="invite_phone"
            :required="true"
            data-test="phoneInvite"
            @updateMask="updateMask($event)"
            @phoneFieldInputted="phoneInput"
        />
        <input type="hidden" v-model="phoneInvite"/>
      </div>
    </validation-provider>
    <div class="col-lg-4 col-12">
      <button
          class="button button_size-50"
          data-test="phoneInviteButton"
          :disable="submitted"
      >
        Пригласить
      </button>
    </div>
  </validation-observer>
</template>

<script>
import Vue from 'vue';
import {mapActions, mapState} from 'vuex';

export default {
  name: 'SharePhone',
  components: {
    PhoneField: () => import('@/components/common/PhoneField')
  },
  props: {
    viewerRole: {
      type: String
    },
  },
  data() {
    return {
      phoneInvite: null,
      maskLength: 0,
      submitted: false
    }
  },
  computed: {
    ...mapState('dealDetails', [
      'deal'
    ]),
    inputLabelText() {
      return this.viewerRole === 'seller' ? 'Телефон покупателя' : 'Телефон продавца';
    }
  },
  methods: {
    ...mapActions('dealDetails', [
      'setDealProps'
    ]),
    phoneInput(value) {
      this.phoneInvite = value;
    },
    updateMask(value) {
      this.maskLength = value.maskLength;
      if (value.maskType === 'change' && !!this.phoneInvite) {
        this.$refs.observerPhoneInvite.validate();
      }
    },
    async sendPhoneInvite() {
      const isValid = await this.$refs.observerPhoneInvite.validate();
      if (isValid && !this.submitted) {
        this.submitted = true;
        Vue.axios.post(this.getPathRequest('deals_invite', {id: this.deal['~id']}), {phone: this.phoneInvite})
          .then(() => {
            this.sendMetricEvent('deals_btm_invite_tel');
            this.setDealProps({field: 'invited_phone', value: this.phoneInvite});
            this.phoneInvite = null;
          })
          .catch(error => {
            this.showModal('modalFailed', {
              title: 'Ошибка отправки приглашения',
              text: error.response.data.message
                ? [error.response.data.message]
                : ['Не удалось отправить приглашение к сделке. Пожалуйста, попробуйте снова или обратитесь к нам в тех. поддержку.']
            });
          })
          .finally(() => {
            this.submitted = false;
          });
      }
    },
    cancelPhoneInvite() {
      Vue.axios.post(this.getPathRequest('cancel_invitation', {id: this.deal['~id']}))
        .then(() => {
          this.setDealProps({field: 'invited_phone', value: null});
          this.phoneInvite = null;
        })
        .catch(error => {
          this.phoneInvite = null;
          this.showModal('modalFailed', {
            title: 'Ошибка отмены приглашения',
            text: error.response.data.message
              ? [error.response.data.message]
              : ['Не удалось отменить приглашение к сделке. Пожалуйста, попробуйте снова или обратитесь к нам в тех. поддержку.']
          });
        });
    }
  }
}
</script>
