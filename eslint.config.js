import antfu from '@antfu/eslint-config';

export default antfu({
	stylistic: {
		semi: true,
		indent: 'tab',
	},
	ignores: ['**/*.d.ts', '*.md'],
	rules: {
		'style/semi': ['error', 'always'],
	},
});
