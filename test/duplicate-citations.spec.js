const { bibtex, test } = require('./utils.js');

const input = bibtex`
@article{a,
    author={Smith, James},
    title="  something blah BLAH."
}
@article{b,
    author={Smith, JA},
    title={Something blah blah}
}`;

test(
	'duplicate citation warnings',
	async (t, tidy) => {
		const tidied = await tidy(input, { duplicates: ['citation'] });
		t.same(tidied.warnings.length, 1);
	},
	{ apiOnly: true }
);
