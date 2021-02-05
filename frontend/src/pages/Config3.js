import React, { useContext } from 'react';
import { Form, Input, Space, Divider, Button, Tabs, Row, Col } from 'antd';
import { MinusCircleOutlined, PlusOutlined } from '@ant-design/icons';
import { AppContext } from '../context/globalState';
import { Layout } from '../components';

const { TabPane } = Tabs;
const { TextArea } = Input;

const Config3 = ({ history }) => {
	const { currentConfig, updateConfig } = useContext(AppContext);
	const [form] = Form.useForm();

	const sanitizeJSON = unsanitized => {	
		return unsanitized
		.replace(/\\/g, "\\\\") // no-useless-escape
		.replace(/\n/g, "\\n") // no-useless-escape
		.replace(/\r/g, "\\r") // no-useless-escape
		.replace(/\t/g, "\\t") // no-useless-escape
		.replace(/\f/g, "\\f") // no-useless-escape
		.replace(/"/g,"\\\"") // no-useless-escape
		// .replace(/'/g,"\\\'") // no-useless-escape
		// .replace(/\&/g, "\\&"); // no-useless-escape
		// .replaceAll(' ', '')
		// .replaceAll(/\n/, '')
	}

	const onSubmit = values => {
		if (values.whitelist) {
			currentConfig.node_config.whitelist = values.whitelist;
		}
		if (values.ticker) {
			currentConfig.req_input.ticker = Number(values.ticker);
		}
		if (values.body) {
			currentConfig.req_input.request.body = sanitizeJSON(values.body);
		}
		if (values.headers) {
			values.headers && values.headers.forEach(({ name, value }) => {
				currentConfig.req_input.request.header[name] = value
			});
		}
		if (values.url) {
			currentConfig.req_input.request.url = values.url;
		} else {
			currentConfig.req_input = null;
		}

		updateConfig(currentConfig);
		history.push('/oracle/4');
	};

	const handleKeyDown = e => {
		if (e.key === 'Enter') {
			e.preventDefault();
		}
		history.goBack();
	};

	return (
		<Layout>
			<div className='form-wrapper'>
				<div className='form-info-wrapper'>
					<Space direction='vertical' align='center'>
						<p className='small'>STEP 3 OF 4</p>
						<h1>Add data source</h1>
						<p>
							Here you can choose the options for input for your oracle. Raw data inputs refer to manually attached data. In order for data to be attached to an oracle, the device/party trying to attach must have their IP address whitelisted, for instance a sensor connecting to a gateway based oracle. The API Retriever details outline the request information to be made on a loop and attached automatically within the oracle. This option requires the entry of at a minimum: A URL Endpoint for the api data, and a ticker rate (in milliseconds) for the rate at which the call will be made. The oracle will automatically convert the data to an IOTA message that can be retrieved from the oracle instance.
						</p>
					</Space>
				</div>
				<Divider />
				<Form
					form={form}
					layout='vertical'
					validateTrigger='onSubmit'
					scrollToFirstError
					colon={false}
					name='api-retriever-form'
					onFinish={onSubmit}
					hideRequiredMark
					initialValues={{ headers: [''], whitelist: [''] }}>
					<Tabs tabBarGutter={50} centered defaultActiveKey='1'>
						<TabPane tab='Raw data' key='1'>
							<div className='tab-container'>
								<div className='input-wrapper'>
									<Form.List name='whitelist'>
										{(fields, { add, remove }, { errors }) => (
											<div>
												{fields.map((field, index) => (
													<Form.Item label={index === 0 ? 'Whitelisted IP' : ''} required={false} key={field.key}>
														<div className='input-wrapper-dynamic'>
															<Form.Item {...field} validateTrigger={['onChange', 'onBlur']} noStyle>
																<Input placeholder='IP address' className='rounded-input' />
															</Form.Item>
															{fields.length > 1 ? (
																<MinusCircleOutlined className='dynamic-delete-button' onClick={() => remove(field.name)} />
															) : null}
														</div>
													</Form.Item>
												))}
												<Form.Item>
													<Button className='add-item-btn' onClick={() => add()} icon={<PlusOutlined />}>
														Add new IP
													</Button>
													<Form.ErrorList errors={errors} />
												</Form.Item>
											</div>
										)}
									</Form.List>
								</div>
							</div>
						</TabPane>
						<TabPane tab='API Retriever' key='2'>
							<div className='tab-container'>
								<div className='input-wrapper-md'>
									<Row justify='space-between' align='middle' gutter={30}>
										<Col span={12}>
											<Form.Item name='url' label='Endpoint'>
												<Input className='rounded-input' />
											</Form.Item>
										</Col>
										<Col span={12}>
											<Form.Item name='ticker' label='Ticker rate'>
												<Input className='rounded-input' />
											</Form.Item>
										</Col>
									</Row>
									<div className='input-wrapper-dynamic-md'>
										<Form.List name='headers'>
											{(fields, { add, remove }, { errors }) => (
												<div>
													{fields.map((field, index) => (
														<Form.Item label={index === 0 ? 'Headers' : ''} required={false} key={field.key}>
															<Row key={field.key} gutter={[30, 0]}>
																<Col span={12}>
																	<Form.Item name={[field.name, 'name']} fieldKey={[field.fieldKey, 'name']} noStyle>
																		<Input placeholder='Header name' className='rounded-input' />
																	</Form.Item>
																</Col>
																<Col span={12}>
																	<Form.Item name={[field.name, 'value']} fieldKey={[field.value, 'value']} required noStyle>
																		<Input placeholder='Value' className='rounded-input' />
																	</Form.Item>
																</Col>
																<div className='delete-btn-wrpr'>
																	<Form.Item>
																		{fields.length > 1 ? (
																			<MinusCircleOutlined
																				className='dynamic-delete-button'
																				onClick={() => remove(field.name)}
																			/>
																		) : null}
																	</Form.Item>
																</div>
															</Row>
														</Form.Item>
													))}
													<Form.Item>
														<Button className='add-item-btn' onClick={() => add()} icon={<PlusOutlined />}>
															Add new Header
														</Button>
														<Form.ErrorList errors={errors} />
													</Form.Item>
												</div>
											)}
										</Form.List>
									</div>
									<Row justify='space-between' align='middle' gutter={30}>
										<Col span={24}>
											<Form.Item name='body' label='Body'>
												<TextArea autoSize={{ minRows: 5, maxRows: 10 }} className='body-input' />
											</Form.Item>
										</Col>
									</Row>
								</div>
							</div>
						</TabPane>
					</Tabs>
					<Divider />
					<div className='btns-wrapper'>
						<Space size='middle'>
							<button onClick={handleKeyDown} type='button' className='custom-button-2'>
								Back
							</button>
							<button className='custom-button' type='submit'>
								Continue
							</button>
						</Space>
					</div>
				</Form>
			</div>
		</Layout>
	);
};

export default Config3;
